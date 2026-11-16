// Comparaison du portefeuille avec un indice de référence (« benchmark »).
// Principe du portefeuille fantôme : chaque euro investi dans une action est investi
// le même jour dans l'indice, et retiré le jour où la position est vendue.

import { FEE_RATE, orderFees } from "./fees";
import { PositionRow, positionCost } from "./portfolio";
import { Chart, FxSeries, PricePoint, fxAt, getChart, getFx, rangeCovering, round, valueAt } from "./yahoo";

export interface Benchmark {
  id: string;
  symbol: string;
  name: string;
  currency: string;
  kind: "index" | "rate"; // rate : taux annuel en % (placement sans risque)
  description: string;
}

export const BENCHMARKS: Benchmark[] = [
  { id: "stoxx600", symbol: "^STOXX", name: "STOXX Europe 600", currency: "EUR", kind: "index", description: "Les 600 plus grandes entreprises européennes : la référence naturelle d'un portefeuille d'actions européennes." },
  { id: "cac40", symbol: "^FCHI", name: "CAC 40", currency: "EUR", kind: "index", description: "Les 40 plus grandes entreprises françaises cotées à Paris." },
  { id: "stoxx50", symbol: "^STOXX50E", name: "Euro Stoxx 50", currency: "EUR", kind: "index", description: "Les 50 plus grandes entreprises de la zone euro." },
  { id: "sp500", symbol: "^GSPC", name: "S&P 500", currency: "USD", kind: "index", description: "Les 500 plus grandes entreprises américaines, l'indice le plus suivi au monde (converti en euros)." },
  { id: "world", symbol: "IWDA.AS", name: "MSCI World (ETF)", currency: "EUR", kind: "index", description: "Environ 1 400 entreprises des pays développés, via un ETF qui réinvestit les dividendes." },
  { id: "tbill", symbol: "^IRX", name: "Bons du Trésor US (3 mois)", currency: "EUR", kind: "rate", description: "Le « taux sans risque » : ce qu'aurait rapporté un placement quasiment sans risque." },
];

export const DEFAULT_BENCHMARK = "stoxx600";

export interface BenchmarkPoint {
  t: number;
  portfolio: number; // gain cumulé du portefeuille (€)
  benchmark: number; // gain cumulé du portefeuille fantôme (€)
}

// Série de niveaux de l'indice. Pour un taux, on construit un indice de capitalisation :
// I(j) = I(j-1) × (1 + taux(j-1) / 100 × jours écoulés / 360).
function levelsFor(b: Benchmark, chart: Chart): PricePoint[] {
  if (b.kind === "index") return chart.points;
  const out: PricePoint[] = [];
  let level = 1;
  chart.points.forEach((p, i) => {
    if (i > 0) {
      const prev = chart.points[i - 1];
      const days = (Date.parse(p.date) - Date.parse(prev.date)) / 86_400_000;
      level *= 1 + (prev.close / 100) * (days / 360);
    }
    out.push({ date: p.date, close: level });
  });
  return out;
}

export async function computeBenchmark(rows: PositionRow[], id: string) {
  const b = BENCHMARKS.find((x) => x.id === id) ?? BENCHMARKS.find((x) => x.id === DEFAULT_BENCHMARK)!;
  const base = { benchmark: { id: b.id, name: b.name, description: b.description, kind: b.kind } };
  if (!rows.length) return { ...base, summary: null, points: [] as BenchmarkPoint[] };

  const first = rows.reduce((m, r) => (r.buy_date < m ? r.buy_date : m), rows[0].buy_date);
  const range = rangeCovering(first);

  const charts = new Map<string, Chart>();
  const fxs = new Map<string, FxSeries>();
  const [benchChart, benchFx] = await Promise.all([
    getChart(b.symbol, range),
    getFx(b.kind === "rate" ? "EUR" : b.currency, range),
    ...[...new Set(rows.map((r) => r.symbol))].map(async (s) => charts.set(s, await getChart(s, range).catch(() => null as any))),
    ...[...new Set(rows.map((r) => r.currency))].map(async (c) => fxs.set(c, await getFx(c, range).catch(() => null as any))),
  ]);
  const levels = levelsFor(b, benchChart as Chart);
  const bfx = benchFx as FxSeries;
  const feeRate = b.kind === "rate" ? 0 : FEE_RATE; // un placement sans risque n'a pas de frais de courtage

  // Chaque position et son double dans l'indice.
  const lots = rows.map((r) => {
    const cost = positionCost(r);
    const level0 = valueAt(levels, r.buy_date)!;
    const units = cost / (1 + feeRate) / (level0 * fxAt(bfx, r.buy_date));
    const benchValueAt = (d: string) => units * valueAt(levels, d)! * fxAt(bfx, d);
    const sold = !!(r.sell_date && r.sell_price != null);
    const realized = sold ? r.quantity * r.sell_price! * (r.sell_fx ?? 1) - r.sell_fees - cost : 0;
    const benchGross = sold ? benchValueAt(r.sell_date!) : 0;
    const benchRealized = sold ? benchGross - (feeRate ? orderFees(benchGross) : 0) - cost : 0;
    return { r, cost, sold, realized, benchRealized, benchValueAt };
  });

  const dates = new Set<string>();
  for (const c of charts.values()) c?.points.forEach((p) => p.date >= first && dates.add(p.date));
  levels.forEach((p) => p.date >= first && dates.add(p.date));
  const sorted = [...dates].sort();

  const points: BenchmarkPoint[] = sorted.map((d) => {
    let p = 0;
    let q = 0;
    for (const l of lots) {
      if (l.r.buy_date > d) continue;
      if (l.sold && l.r.sell_date! <= d) {
        p += l.realized;
        q += l.benchRealized;
        continue;
      }
      const chart = charts.get(l.r.symbol);
      const fx = fxs.get(l.r.currency);
      const close = (chart && valueAt(chart.points, d)) ?? l.r.buy_price;
      const rate = fx ? fxAt(fx, d) : l.r.buy_fx;
      p += l.r.quantity * close * rate - l.cost;
      q += l.benchValueAt(d) - l.cost;
    }
    return { t: Date.parse(d) / 1000, portfolio: round(p), benchmark: round(q) };
  });

  const totalCost = lots.reduce((s, l) => s + l.cost, 0);
  const last = points[points.length - 1] ?? { portfolio: 0, benchmark: 0 };
  return {
    ...base,
    summary: {
      since: first,
      totalCost: round(totalCost),
      portfolioPnl: last.portfolio,
      portfolioPct: totalCost ? round((last.portfolio / totalCost) * 100) : 0,
      benchmarkPnl: last.benchmark,
      benchmarkPct: totalCost ? round((last.benchmark / totalCost) * 100) : 0,
      difference: round(last.portfolio - last.benchmark),
    },
    points,
  };
}
