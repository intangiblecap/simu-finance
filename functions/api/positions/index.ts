import type { Env } from "../../../lib/env";
import { HttpError, errorResponse, isIsoDate, json, readJson, todayParis } from "../../../lib/http";
import { executionAt, loadMarket } from "../../../lib/portfolio";
import { EUROPEAN_EXCHANGES, exchangeSuffix, isEuropean, round } from "../../../lib/yahoo";

interface BuyRequest {
  symbol?: string;
  date?: string; // défaut : aujourd'hui
  mode?: "amount" | "quantity";
  amount?: number; // EUR, frais non compris
  quantity?: number;
  fees?: number; // EUR
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
    const fees = Number(body.fees ?? 0);
    if (!Number.isFinite(fees) || fees < 0) throw new HttpError(400, "Frais invalides");

    const { chart, fx } = await loadMarket(symbol, null, date);
    if (chart.instrumentType && chart.instrumentType !== "EQUITY") {
      throw new HttpError(400, "Seules les actions sont supportées pour l'instant");
    }
    const exec = executionAt(chart, fx, date);
    const unitEur = exec.price * exec.fx;

    let quantity: number;
    if (body.mode === "amount") {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, "Montant invalide");
      quantity = Math.floor(amount / unitEur);
      if (quantity < 1) {
        throw new HttpError(400, `Montant insuffisant : une action coûte ${round(unitEur)} €`);
      }
    } else {
      quantity = Number(body.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) throw new HttpError(400, "Quantité invalide");
    }

    const estimate = {
      symbol: chart.symbol,
      name: chart.name,
      currency: chart.currency,
      date: exec.date,
      price: exec.price,
      fx: exec.fx,
      quantity,
      fees,
      total: round(quantity * unitEur + fees),
    };
    if (dryRun) return json({ estimate });

    const row = await env.DB.prepare(
      `INSERT INTO positions (instrument_type, symbol, name, exchange, currency, quantity, buy_date, buy_price, buy_fx, buy_fees)
       VALUES ('stock', ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(
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
