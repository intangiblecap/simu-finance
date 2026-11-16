import type { Env } from "../../../lib/env";
import { HttpError, errorResponse, isIsoDate, json, readJson, todayParis } from "../../../lib/http";
import { executionAt, loadMarket } from "../../../lib/portfolio";
import { currentPortfolio } from "../../../lib/scope";
import { MIN_ORDER_EUR, floorQty, netFromBudget, orderFees } from "../../../lib/fees";
import { EUROPEAN_EXCHANGES, exchangeSuffix, isEuropean, round } from "../../../lib/yahoo";

interface BuyRequest {
  symbol?: string;
  date?: string; // défaut : aujourd'hui
  mode?: "amount" | "quantity";
  amount?: number; // EUR, budget total frais inclus
  quantity?: number; // fractions acceptées
}

// Achat simulé. Avec ?dryRun=1, renvoie l'estimation sans rien enregistrer.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const body = await readJson<BuyRequest>(request);
    const symbol = String(body.symbol ?? "").toUpperCase();
    if (!isEuropean(symbol)) throw new HttpError(400, "Instrument non supporté");
    const date = body.date ?? todayParis();
    if (!isIsoDate(date)) throw new HttpError(400, "Date invalide");
    const pf = await currentPortfolio(env, request);
    if (date < pf.start_date) {
      throw new HttpError(400, `Le portefeuille « ${pf.name} » démarre le ${pf.start_date} : choisis une date à partir de celle-ci`);
    }

    const { chart, fx } = await loadMarket(symbol, null, date);
    if (chart.instrumentType && chart.instrumentType !== "EQUITY") {
      throw new HttpError(400, "Seules les actions sont supportées pour l'instant");
    }
    const exec = executionAt(chart, fx, date);
    const unitEur = exec.price * exec.fx;

    // Fractions d'actions autorisées (voir QTY_DECIMALS). Frais calculés automatiquement.
    let quantity: number;
    let fees: number;
    if (body.mode === "amount") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount < MIN_ORDER_EUR) throw new HttpError(400, `Montant minimum : ${MIN_ORDER_EUR} €`);
      const split = netFromBudget(amount);
      fees = split.fees;
      quantity = floorQty(split.net / unitEur);
    } else {
      quantity = floorQty(Number(body.quantity));
      if (!Number.isFinite(quantity) || quantity <= 0) throw new HttpError(400, "Quantité invalide");
      fees = orderFees(quantity * unitEur);
    }
    if (quantity <= 0) throw new HttpError(400, "Montant trop faible");
    const invested = round(quantity * unitEur);

    const estimate = {
      symbol: chart.symbol,
      name: chart.name,
      currency: chart.currency,
      date: exec.date,
      price: exec.price,
      fx: exec.fx,
      quantity,
      invested,
      fees,
      total: round(invested + fees),
    };
    if (dryRun) return json({ estimate });

    const row = await env.DB.prepare(
      `INSERT INTO positions (portfolio_id, instrument_type, symbol, name, exchange, currency, quantity, buy_date, buy_price, buy_fx, buy_fees)
       VALUES (?, 'stock', ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(
        pf.id,
        chart.symbol,
        chart.name,
        EUROPEAN_EXCHANGES[exchangeSuffix(symbol)!] ?? chart.exchange,
        chart.currency,
        quantity,
        exec.date,
        exec.price,
        exec.fx,
        fees,
      )
      .first<{ id: number }>();
    return json({ id: row?.id, estimate }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
};
