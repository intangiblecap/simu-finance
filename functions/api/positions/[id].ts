import type { Env } from "../../../lib/env";
import { HttpError, errorResponse, isIsoDate, json, readJson, todayParis } from "../../../lib/http";
import { PositionRow, executionAt, loadMarket } from "../../../lib/portfolio";
import { orderFees } from "../../../lib/fees";
import { currentPortfolio } from "../../../lib/scope";
import { round } from "../../../lib/yahoo";

async function getRow(env: Env, id: string, request: Request): Promise<PositionRow> {
  const pf = await currentPortfolio(env, request);
  const row = await env.DB.prepare("SELECT * FROM positions WHERE id = ? AND portfolio_id = ?")
    .bind(Number(id), pf.id)
    .first<PositionRow>();
  if (!row) throw new HttpError(404, "Position introuvable");
  return row;
}

interface PatchRequest {
  action?: "sell" | "reopen";
  date?: string;
}

// Vente simulée (clôture du lot) ou annulation de la vente. ?dryRun=1 pour une estimation.
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const row = await getRow(env, String(params.id), request);
    const body = await readJson<PatchRequest>(request);

    if (body.action === "reopen") {
      await env.DB.prepare(
        "UPDATE positions SET sell_date = NULL, sell_price = NULL, sell_fx = NULL, sell_fees = 0 WHERE id = ?",
      )
        .bind(row.id)
        .run();
      return json({ ok: true });
    }
    if (body.action !== "sell") throw new HttpError(400, "Action inconnue");
    if (row.sell_date) throw new HttpError(400, "Position déjà vendue");

    const date = body.date ?? todayParis();
    if (!isIsoDate(date)) throw new HttpError(400, "Date invalide");
    if (date < row.buy_date) throw new HttpError(400, "La vente ne peut pas précéder l'achat");

    const { chart, fx } = await loadMarket(row.symbol, row.currency, date);
    const exec = executionAt(chart, fx, date);
    const gross = row.quantity * exec.price * exec.fx;
    const fees = orderFees(gross);
    const proceeds = gross - fees;
    const cost = row.quantity * row.buy_price * row.buy_fx + row.buy_fees;
    const estimate = {
      date: exec.date,
      price: exec.price,
      fx: exec.fx,
      gross: round(gross),
      fees,
      proceeds: round(proceeds),
      pnl: round(proceeds - cost),
    };
    if (new URL(request.url).searchParams.get("dryRun") === "1") return json({ estimate });

    await env.DB.prepare("UPDATE positions SET sell_date = ?, sell_price = ?, sell_fx = ?, sell_fees = ? WHERE id = ?")
      .bind(exec.date, exec.price, exec.fx, fees, row.id)
      .run();
    return json({ ok: true, estimate });
  } catch (e) {
    return errorResponse(e);
  }
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params, request }) => {
  try {
    const row = await getRow(env, String(params.id), request);
    await env.DB.prepare("DELETE FROM positions WHERE id = ?").bind(row.id).run();
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};
