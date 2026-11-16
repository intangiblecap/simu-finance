import type { Env } from "../../../lib/env";
import { HttpError, errorResponse, json } from "../../../lib/http";
import { EUROPEAN_EXCHANGES, Range, exchangeSuffix, getChart, getFx, isEuropean } from "../../../lib/yahoo";

const RANGES: Range[] = ["5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"];

// Fiche d'un instrument : cours, historique et taux de change actuel vers l'EUR.
export const onRequestGet: PagesFunction<Env> = async ({ request, params }) => {
  try {
    const symbol = String(params.symbol).toUpperCase();
    if (!isEuropean(symbol)) throw new HttpError(400, "Seules les places européennes sont supportées pour l'instant");
    const rq = new URL(request.url).searchParams.get("range") as Range | null;
    const range: Range = rq && RANGES.includes(rq) ? rq : "1y";
    const chart = await getChart(symbol, range);
    const fx = await getFx(chart.currency, "5d");
    const pts = chart.points;
    const prev = pts.length >= 2 ? pts[pts.length - 2].close : chart.price;
    return json({
      symbol: chart.symbol,
      name: chart.name,
      exchange: EUROPEAN_EXCHANGES[exchangeSuffix(symbol)!] ?? chart.exchange,
      currency: chart.currency,
      price: chart.price,
      fx: fx.current,
      change: chart.price - prev,
      changePct: prev ? ((chart.price - prev) / prev) * 100 : 0,
      marketTime: chart.marketTime,
      range,
      points: pts,
    });
  } catch (e) {
    return errorResponse(e);
  }
};
