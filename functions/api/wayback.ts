import type { Env } from "../../lib/env";
import { MIN_ORDER_EUR, floorQty, netFromBudget } from "../../lib/fees";
import { HttpError, errorResponse, isIsoDate, json, readJson, todayParis } from "../../lib/http";
import { PositionRow, executionAt, loadMarket, positionCost } from "../../lib/portfolio";
import { PortfolioRow, currentPortfolio, portfolioRows } from "../../lib/scope";
import { EUROPEAN_EXCHANGES, exchangeSuffix, isEuropean, round, shortName } from "../../lib/yahoo";

// « Remonter le temps » : voir et modifier les montants investis à une date donnée.
//   GET  /api/wayback?date=YYYY-MM-DD             → une ligne par action du portefeuille
//   POST /api/wayback[?dryRun=1] {date, items}    → fixe le montant investi ce jour-là pour chaque action

async function lineFor(symbol: string, date: string, rows: PositionRow[]) {
  const { chart, fx } = await loadMarket(symbol, null, date);
  const exec = executionAt(chart, fx, date);
  const sameDay = rows.filter((r) => r.symbol === chart.symbol && r.buy_date === exec.date);
  const open = sameDay.filter((r) => !r.sell_date);
  const priceNowEur = chart.price * fx.current;
  const priceThenEur = exec.price * exec.fx;
  return {
    chart,
    fx,
    exec,
    open,
    line: {
      symbol: chart.symbol,
      name: shortName(chart.name),
      currency: chart.currency,
      execDate: exec.date,
      priceThen: exec.price,
      priceNow: chart.price,
      changePct: priceThenEur ? round(((priceNowEur - priceThenEur) / priceThenEur) * 100) : 0,
      amount: round(open.reduce((s, r) => s + positionCost(r), 0)), // montant actuellement investi ce jour-là
      soldCount: sameDay.length - open.length, // achats de ce jour déjà vendus (non modifiables ici)
    },
  };
}

function checkDate(date: unknown, pf: PortfolioRow): string {
  if (!isIsoDate(date)) throw new HttpError(400, "Date invalide");
  if (date > todayParis()) throw new HttpError(400, "La date ne peut pas être dans le futur");
  if (date < pf.start_date) throw new HttpError(400, `Le portefeuille « ${pf.name} » démarre le ${pf.start_date}`);
  return date;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const pf = await currentPortfolio(env, request);
    const date = checkDate(new URL(request.url).searchParams.get("date"), pf);
    const rows = await portfolioRows(env, pf.id);
    const symbols = [...new Set(rows.map((r) => r.symbol))];
    const lines = await Promise.all(
      symbols.map((s) =>
        lineFor(s, date, rows).then(
          (x) => x.line,
          (e) => ({ symbol: s, name: rows.find((r) => r.symbol === s)!.name, error: (e as Error).message }),
        ),
      ),
    );
    return json({ date, lines });
  } catch (e) {
    return errorResponse(e);
  }
};

interface Item {
  symbol?: string;
  amount?: number; // total débité ce jour-là, frais inclus ; 0 = retirer
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const body = await readJson<{ date?: string; items?: Item[] }>(request);
    const pf = await currentPortfolio(env, request);
    const date = checkDate(body.date, pf);
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    if (!items.length) throw new HttpError(400, "Aucune modification");
    const rows = await portfolioRows(env, pf.id);

    const plans = await Promise.all(
      items.map(async (it) => {
        const symbol = String(it.symbol ?? "").toUpperCase();
        const amount = Number(it.amount ?? 0);
        if (!isEuropean(symbol)) throw new HttpError(400, `Instrument non supporté : ${symbol}`);
        if (!Number.isFinite(amount) || amount < 0) throw new HttpError(400, `Montant invalide pour ${symbol}`);
        if (amount > 0 && amount < MIN_ORDER_EUR) throw new HttpError(400, `Montant minimum : ${MIN_ORDER_EUR} € (${symbol})`);
        const { chart, fx, exec, open, line } = await lineFor(symbol, date, rows).catch((e) => {
          throw new HttpError(400, `${symbol} : ${(e as Error).message}`);
        });
        const unitEur = exec.price * exec.fx;
        const { net, fees } = amount > 0 ? netFromBudget(amount) : { net: 0, fees: 0 };
        const quantity = amount > 0 ? floorQty(net / unitEur) : 0;
        const invested = round(quantity * unitEur + fees);
        const valueNow = round(quantity * chart.price * fx.current);
        return {
          chart,
          exec,
          replace: open.map((r) => r.id),
          quantity,
          fees,
          preview: {
            ...line,
            newAmount: invested,
            quantity,
            fees,
            valueNow,
            pnl: round(valueNow - invested),
            pnlPct: invested ? round(((valueNow - invested) / invested) * 100) : 0,
          },
        };
      }),
    );

    const totals = plans.reduce(
      (t, p) => ({ invested: t.invested + p.preview.newAmount, valueNow: t.valueNow + p.preview.valueNow }),
      { invested: 0, valueNow: 0 },
    );
    const result = {
      date,
      lines: plans.map((p) => p.preview),
      totals: {
        invested: round(totals.invested),
        valueNow: round(totals.valueNow),
        pnl: round(totals.valueNow - totals.invested),
        pnlPct: totals.invested ? round(((totals.valueNow - totals.invested) / totals.invested) * 100) : 0,
      },
    };
    if (dryRun) return json(result);

    // Application atomique : on remplace les achats ouverts de ce jour par un achat au nouveau montant.
    const stmts: D1PreparedStatement[] = [];
    for (const p of plans) {
      for (const id of p.replace) stmts.push(env.DB.prepare("DELETE FROM positions WHERE id = ?").bind(id));
      if (p.quantity > 0) {
        stmts.push(
          env.DB.prepare(
            `INSERT INTO positions (portfolio_id, instrument_type, symbol, name, exchange, currency, quantity, buy_date, buy_price, buy_fx, buy_fees)
             VALUES (?, 'stock', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            pf.id,
            p.chart.symbol,
            p.chart.name,
            EUROPEAN_EXCHANGES[exchangeSuffix(p.chart.symbol)!] ?? p.chart.exchange,
            p.chart.currency,
            p.quantity,
            p.exec.date,
            p.exec.price,
            p.exec.fx,
            p.fees,
          ),
        );
      }
    }
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ...result, applied: true });
  } catch (e) {
    return errorResponse(e);
  }
};
