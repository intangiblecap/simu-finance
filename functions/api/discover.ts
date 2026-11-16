import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import { FEATURED, TREND_TOP_N, TREND_UNIVERSE } from "../../lib/universe";
import { EUROPEAN_EXCHANGES, exchangeSuffix, getSpark } from "../../lib/yahoo";

// Nom court pour les listes : sans forme juridique (S.A., AG, plc…).
function shortName(name: string): string {
  return name
    .replace(/,?\s+(S\.?A\.?|SE|AG|plc|PLC|N\.?V\.?|A\/S|S\.p\.A\.?|SpA|Société Anonyme|Group|Holding)\.?$/i, "")
    .replace(/,?\s+(S\.?A\.?|SE|AG|plc|N\.?V\.?)\.?$/i, "")
    .trim();
}

// Onglet « Découvrir » : tendances du jour (plus fortes hausses / baisses parmi
// les grandes capitalisations européennes) et 20 actions à connaître.
export const onRequestGet: PagesFunction<Env> = async () => {
  try {
    const quotes = await getSpark([...new Set(TREND_UNIVERSE)]);
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q]));
    const exchange = (s: string) => EUROPEAN_EXCHANGES[exchangeSuffix(s) ?? ""] ?? "";
    const featuredName = new Map(FEATURED.map((f) => [f.symbol, f.name]));
    const view = (q: (typeof quotes)[number]) => ({
      ...q,
      name: featuredName.get(q.symbol) ?? shortName(q.name),
      exchange: exchange(q.symbol),
    });

    const sorted = [...quotes].sort((a, b) => b.changePct - a.changePct);
    return json({
      asOf: Math.max(0, ...quotes.map((q) => q.marketTime)),
      universeSize: quotes.length,
      gainers: sorted.filter((q) => q.changePct > 0).slice(0, TREND_TOP_N).map(view),
      losers: sorted.filter((q) => q.changePct < 0).reverse().slice(0, TREND_TOP_N).map(view),
      featured: FEATURED.map((f) => {
        const q = bySymbol.get(f.symbol);
        return { ...f, exchange: exchange(f.symbol), quote: q ? view(q) : null };
      }),
    });
  } catch (e) {
    return errorResponse(e);
  }
};
