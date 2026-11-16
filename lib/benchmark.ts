// Comparaison du portefeuille avec des références (indices, taux sans risque, inflation).
// Principe du portefeuille fantôme : chaque euro investi dans une action est placé le même
// jour dans la référence, et retiré le jour où la position est vendue.

import { FEE_RATE, orderFees } from "./fees";
import { getInflation } from "./inflation";
import { todayParis } from "./http";
import { PositionRow, positionCost } from "./portfolio";
import { Chart, FxSeries, PricePoint, fxAt, getChart, getFx, rangeCovering, round, valueAt } from "./yahoo";

export type BenchmarkKind = "index" | "rate" | "inflation";

export interface Benchmark {
  id: string;
  symbol: string;
  name: string;
  short: string; // nom court pour les légendes
  currency: string;
  kind: BenchmarkKind;
  group: "Marchés actions" | "Sans risque" | "Pouvoir d'achat";
  description: string;
}

export const BENCHMARKS: Benchmark[] = [
  { id: "stoxx600", symbol: "^STOXX", name: "STOXX Europe 600", short: "STOXX 600", currency: "EUR", kind: "index", group: "Marchés actions", description: "Les 600 plus grandes entreprises européennes : la référence naturelle d'un portefeuille d'actions européennes." },
  { id: "cac40", symbol: "^FCHI", name: "CAC 40", short: "CAC 40", currency: "EUR", kind: "index", group: "Marchés actions", description: "Les 40 plus grandes entreprises françaises cotées à Paris." },
  { id: "stoxx50", symbol: "^STOXX50E", name: "Euro Stoxx 50", short: "Euro Stoxx 50", currency: "EUR", kind: "index", group: "Marchés actions", description: "Les 50 plus grandes entreprises de la zone euro." },
  { id: "sp500", symbol: "^GSPC", name: "S&P 500", short: "S&P 500", currency: "USD", kind: "index", group: "Marchés actions", description: "Les 500 plus grandes entreprises américaines, l'indice le plus suivi au monde (converti en euros)." },
  { id: "world", symbol: "IWDA.AS", name: "MSCI World (ETF)", short: "MSCI World", currency: "EUR", kind: "index", group: "Marchés actions", description: "Environ 1 400 entreprises des pays développés, via un ETF qui réinvestit les dividendes." },
  { id: "tbill", symbol: "^IRX", name: "Bons du Trésor US (3 mois)", short: "Taux sans risque", currency: "EUR", kind: "rate", group: "Sans risque", description: "Le « taux sans risque » : ce qu'aurait rapporté un placement quasiment sans risque." },
  { id: "inflation", symbol: "HICP-FR", name: "Inflation (France)", short: "Inflation", currency: "EUR", kind: "inflation", group: "Pouvoir d'achat", description: "La hausse des prix : ce qu'il fallait gagner simplement pour conserver ton pouvoir d'achat." },
];

export const DEFAULT_BENCHMARK = "stoxx600";

export interface BenchmarkPoint {
  t: number;
  portfolio: number; // gain cumulé du portefeuille (€)
  benchmark: number; // gain cumulé du portefeuille fantôme (€)
}

// Indice de capitalisation d'un taux annuel en % : I(j) = I(j-1) × (1 + taux(j-1) / 100 × jours / 360).
function rateToLevels(points: PricePoint[]): PricePoint[] {
  let level = 1;
  return points.map((p, i) => {
    if (i > 0) {
      const prev = points[i - 1];
      const days = (Date.parse(p.date) - Date.parse(prev.date)) / 86_400_000;
      level *= 1 + (prev.close / 100) * (days / 360);
    }
    return { date: p.date, close: level };
  });
}

interface Reference {
  b: Benchmark;
  levels: PricePoint[];
  fx: FxSeries | null;
  feeRate: number;
  meta?: Record<string, unknown>;
}

async function loadReference(b: Benchmark, first: string): Promise<Reference> {
  const range = rangeCovering(first);
  if (b.kind === "inflation") {
    const inf = await getInflation(first, todayParis());
    return {
      b,
      levels: inf.daily,
      fx: null,
      feeRate: 0,
      meta: { lastPublished: inf.lastPublished, extrapolatedAnnualRate: round(((1 + inf.extrapolatedMonthlyRate) ** 12 - 1) * 100, 2) },
    };
  }
  const chart = await getChart(b.symbol, range);
  if (b.kind === "rate") return { b, levels: rateToLevels(chart.points), fx: null, feeRate: 0 };
  return { b, levels: chart.points, fx: b.currency === "EUR" ? null : await getFx(b.currency, range), feeRate: FEE_RATE };
}

export async function computeBenchmarks(rows: PositionRow[], ids: string[]) {
  const selected = BENCHMARKS.filter((b) => ids.includes(b.id));
  if (!rows.length) {
    return { since: null, totalCost: 0, portfolio: null, references: selected.map((b) => ({ ...describe(b), summary: null, points: [] })) };
  }
  const first = rows.reduce((m, r) => (r.buy_date < m ? r.buy_date : m), rows[0].buy_date);
  const range = rangeCovering(first);

  // Données du portefeuille (une seule fois pour toutes les références).
  const charts = new Map<string, Chart | null>();
  const fxs = new Map<string, FxSeries | null>();
  const refResults = await Promise.all([
    ...[...new Set(rows.map((r) => r.symbol))].map(async (s) => void charts.set(s, await getChart(s, range).catch(() => null))),
    ...[...new Set(rows.map((r) => r.currency))].map(async (c) => void fxs.set(c, await getFx(c, range).catch(() => null))),
  ]).then(() =>
    Promise.all(
      selected.map((b) =>
        loadReference(b, first).then(
          (ref) => ({ ok: true as const, ref }),
          (e) => ({ ok: false as const, b, error: (e as Error).message }),
        ),
      ),
    ),
  );

  const lots = rows.map((r) => {
    const cost = positionCost(r);
    const sold = !!(r.sell_date && r.sell_price != null);
    const realized = sold ? r.quantity * r.sell_price! * (r.sell_fx ?? 1) - r.sell_fees - cost : 0;
    return { r, cost, sold, realized };
  });

  const dates = new Set<string>();
  for (const c of charts.values()) c?.points.forEach((p) => p.date >= first && dates.add(p.date));
  const sorted = [...dates].sort();
  const totalCost = lots.reduce((s, l) => s + l.cost, 0);

  // Gain cumulé du portefeuille à chaque date.
  const portfolioPnl = sorted.map((d) => {
    let p = 0;
    for (const l of lots) {
      if (l.r.buy_date > d) continue;
      if (l.sold && l.r.sell_date! <= d) {
        p += l.realized;
        continue;
      }
      const chart = charts.get(l.r.symbol);
      const fx = fxs.get(l.r.currency);
      const close = (chart && valueAt(chart.points, d)) ?? l.r.buy_price;
      p += l.r.quantity * close * (fx ? fxAt(fx, d) : l.r.buy_fx) - l.cost;
    }
    return round(p);
  });
  const lastPnl = portfolioPnl[portfolioPnl.length - 1] ?? 0;

  const references = refResults.map((res) => {
    if (!res.ok) return { ...describe(res.b), error: res.error, summary: null, points: [] as BenchmarkPoint[] };
    const { b, levels, fx, feeRate, meta } = res.ref;
    const rate = (d: string) => (fx ? fxAt(fx, d) : 1);
    // Le double de chaque position dans la référence.
    const twins = lots.map((l) => {
      const units = l.cost / (1 + feeRate) / (valueAt(levels, l.r.buy_date)! * rate(l.r.buy_date));
      const valueAt_ = (d: string) => units * valueAt(levels, d)! * rate(d);
      let realized = 0;
      if (l.sold) {
        const gross = valueAt_(l.r.sell_date!);
        realized = gross - (feeRate ? orderFees(gross) : 0) - l.cost;
      }
      return { l, valueAt: valueAt_, realized };
    });
    const points: BenchmarkPoint[] = sorted.map((d, i) => {
      let q = 0;
      for (const tw of twins) {
        if (tw.l.r.buy_date > d) continue;
        q += tw.l.sold && tw.l.r.sell_date! <= d ? tw.realized : tw.valueAt(d) - tw.l.cost;
      }
      return { t: Date.parse(d) / 1000, portfolio: portfolioPnl[i], benchmark: round(q) };
    });
    const last = points[points.length - 1]?.benchmark ?? 0;
    return {
      ...describe(b),
      meta,
      summary: {
        pnl: last,
        pct: totalCost ? round((last / totalCost) * 100) : 0,
        difference: round(lastPnl - last),
      },
      points,
    };
  });

  return {
    since: first,
    totalCost: round(totalCost),
    portfolio: { pnl: lastPnl, pct: totalCost ? round((lastPnl / totalCost) * 100) : 0 },
    references,
  };
}

function describe(b: Benchmark) {
  return { id: b.id, name: b.name, short: b.short, kind: b.kind, group: b.group, description: b.description };
}
