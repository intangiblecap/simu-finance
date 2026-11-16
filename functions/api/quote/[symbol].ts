import type { Env } from "../../../lib/env";
import { HttpError, errorResponse, json } from "../../../lib/http";
import { EUROPEAN_EXCHANGES, Range, exchangeSuffix, getChart, getFx, getSeries, isEuropean } from "../../../lib/yahoo";

const RANGES: Range[] = ["5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"];
const INTRADAY = { "1d": "1d", "1w": "1w" } as const;

// Fiche d'un instrument : cours, historique et taux de change actuel vers l'EUR.
// range : 1d | 1w (intrajournalier) ou une plage Yahoo (1mo, 1y, 5y, max...).
export const onRequestGet: PagesFunction<Env> = async ({ request, params }) => {
  try {
    const symbol = String(params.symbol).toUpperCase();
    if (!isEuropean(symbol)) throw new HttpError(400, "Seules les places européennes sont supportées pour l'instant");
    const rq = new URL(request.url).searchParams.get("range") ?? "1y";
    const intraday = INTRADAY[rq as keyof typeof INTRADAY];
    const range: Range = intraday ? "5d" : RANGES.includes(rq as Range) ? (rq as Range) : "1y";

    const [chart, series] = await Promise.all([getChart(symbol, range), intraday ? getSeries(symbol, intraday) : null]);
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
      range: intraday ? rq : range,
      intraday: !!intraday,
      points: series ? series.points : pts.map((p) => ({ t: Date.parse(p.date) / 1000, date: p.date, close: p.close })),
    });
  } catch (e) {
    return errorResponse(e);
  }
};
