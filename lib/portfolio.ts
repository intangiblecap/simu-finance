import {
  Chart,
  FxSeries,
  Period,
  PricePoint,
  SeriesPoint,
  fxAt,
  getChart,
  getFx,
  getFxSeries,
  getSeries,
  rangeCovering,
  round,
  seriesAt,
} from "./yahoo";
import { HttpError, todayParis } from "./http";

export interface PositionRow {
  id: number;
  instrument_type: string;
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string;
  quantity: number;
  buy_date: string;
  buy_price: number;
  buy_fx: number;
  buy_fees: number;
  portfolio_id?: number;
  sell_date: string | null;
  sell_price: number | null;
  sell_fx: number | null;
  sell_fees: number;
  created_at: string;
}

// ---------- Exécution d'un ordre simulé à une date ----------

export interface Execution {
  date: string; // jour de bourse effectif
  price: number; // devise de cotation
  fx: number; // EUR par unité de devise
}

// Cours retenu pour un ordre passé à `date` :
// - aujourd'hui (ou plus tard) : dernier cours connu ;
// - date passée : clôture de ce jour, ou du premier jour de bourse suivant.
export function executionAt(chart: Chart, fx: FxSeries, date: string): Execution {
  const today = todayParis();
  const last = chart.points[chart.points.length - 1];
  if (date > today) throw new HttpError(400, "La date ne peut pas être dans le futur");
  if (date >= last.date) {
    return { date: last.date, price: chart.price, fx: fx.current };
  }
  if (date < chart.points[0].date) {
    throw new HttpError(400, `Pas de cotation disponible avant le ${chart.points[0].date}`);
  }
  const p = chart.points.find((pt) => pt.date >= date)!;
  return { date: p.date, price: p.close, fx: fxAt(fx, p.date) };
}

export async function loadMarket(symbol: string, currency: string | null, date: string) {
  const range = rangeCovering(date);
  const chart = await getChart(symbol, range);
  const fx = await getFx(currency ?? chart.currency, range);
  return { chart, fx };
}

// ---------- Calculs de portefeuille ----------

export function positionCost(p: PositionRow): number {
  return p.quantity * p.buy_price * p.buy_fx + p.buy_fees;
}

export interface PositionView {
  id: number;
  type: string;
  symbol: string;
  name: string;
  exchange: string | null;
  currency: string;
  quantity: number;
  buyDate: string;
  buyPrice: number;
  buyFees: number;
  cost: number; // EUR, frais inclus
  status: "open" | "closed";
  sellDate: string | null;
  sellPrice: number | null;
  sellFees: number;
  price: number; // cours actuel (ou de vente) en devise de cotation
  value: number; // EUR : valeur actuelle (ouverte) ou produit de la vente net de frais (clôturée)
  pnl: number;
  pnlPct: number;
  dayChange: number; // EUR, positions ouvertes uniquement
  dayChangePct: number;
  marketTime: number;
}

export interface TimelinePoint {
  t: number; // timestamp (s)
  value: number; // valeur des positions détenues à cet instant
  invested: number; // coût des positions détenues à cet instant
  pnl: number; // plus-value latente + plus-values réalisées
}

export interface Portfolio {
  updatedAt: string;
  summary: {
    value: number;
    invested: number;
    unrealizedPnl: number;
    realizedPnl: number;
    totalPnl: number;
    totalPnlPct: number;
    dayChange: number;
    dayChangePct: number;
    // Bilan sur toute la vie du portefeuille
    totalInvested: number; // somme de tous les achats, frais compris
    proceeds: number; // montants récupérés par les ventes, nets de frais
    feesPaid: number; // frais d'achat et de vente payés
    openCount: number;
    closedCount: number;
  };
  positions: PositionView[];
  allocation: { symbol: string; name: string; value: number; weight: number }[];
  errors: { symbol: string; error: string }[];
}

export async function computePortfolio(rows: PositionRow[]): Promise<Portfolio> {
  // Seuls les cours récents sont nécessaires (dernier cours + clôture de la veille).
  const symRange = new Map<string, "5d">(rows.map((r) => [r.symbol, "5d"]));
  const curRange = new Map<string, "5d">(rows.map((r) => [r.currency, "5d"]));

  const errors: { symbol: string; error: string }[] = [];
  const charts = new Map<string, Chart>();
  const fxs = new Map<string, FxSeries>();
  await Promise.all([
    ...[...symRange].map(async ([s, rg]) => {
      try {
        charts.set(s, await getChart(s, rg));
      } catch (e) {
        errors.push({ symbol: s, error: (e as Error).message });
      }
    }),
    ...[...curRange].map(async ([c, rg]) => {
      try {
        fxs.set(c, await getFx(c, rg));
      } catch (e) {
        errors.push({ symbol: c, error: `Taux de change ${c} : ${(e as Error).message}` });
      }
    }),
  ]);

  const positions: PositionView[] = rows.map((r) => {
    const cost = positionCost(r);
    const chart = charts.get(r.symbol);
    const fx = fxs.get(r.currency);
    const base = {
      id: r.id,
      type: r.instrument_type,
      symbol: r.symbol,
      name: r.name,
      exchange: r.exchange,
      currency: r.currency,
      quantity: r.quantity,
      buyDate: r.buy_date,
      buyPrice: r.buy_price,
      buyFees: r.buy_fees,
      cost: round(cost),
      sellDate: r.sell_date,
      sellPrice: r.sell_price,
      sellFees: r.sell_fees,
    };
    if (r.sell_date && r.sell_price != null) {
      const value = r.quantity * r.sell_price * (r.sell_fx ?? 1) - r.sell_fees;
      return {
        ...base,
        status: "closed" as const,
        price: r.sell_price,
        value: round(value),
        pnl: round(value - cost),
        pnlPct: cost ? round(((value - cost) / cost) * 100) : 0,
        dayChange: 0,
        dayChangePct: 0,
        marketTime: 0,
      };
    }
    // Données de marché indisponibles : on affiche la position au prix d'achat.
    const price = chart?.price ?? r.buy_price;
    const fxNow = fx?.current ?? r.buy_fx;
    const value = r.quantity * price * fxNow;
    let dayChange = 0;
    let dayChangePct = 0;
    if (chart && chart.points.length >= 2) {
      const prev = chart.points[chart.points.length - 2];
      // Si l'achat date d'aujourd'hui, la variation du jour part du prix d'achat.
      const ref = r.buy_date >= chart.points[chart.points.length - 1].date ? r.buy_price : prev.close;
      dayChange = r.quantity * (price - ref) * fxNow;
      dayChangePct = ref ? ((price - ref) / ref) * 100 : 0;
    }
    return {
      ...base,
      status: "open" as const,
      price,
      value: round(value),
      pnl: round(value - cost),
      pnlPct: cost ? round(((value - cost) / cost) * 100) : 0,
      dayChange: round(dayChange),
      dayChangePct: round(dayChangePct),
      marketTime: chart?.marketTime ?? 0,
    };
  });

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");
  const value = sum(open.map((p) => p.value));
  const invested = sum(open.map((p) => p.cost));
  const realizedPnl = sum(closed.map((p) => p.pnl));
  const unrealizedPnl = value - invested;
  const dayChange = sum(open.map((p) => p.dayChange));
  const totalCost = sum(positions.map((p) => p.cost));

  // Répartition par instrument (positions ouvertes).
  const bySymbol = new Map<string, { symbol: string; name: string; value: number }>();
  for (const p of open) {
    const a = bySymbol.get(p.symbol) ?? { symbol: p.symbol, name: p.name, value: 0 };
    a.value += p.value;
    bySymbol.set(p.symbol, a);
  }
  const allocation = [...bySymbol.values()]
    .sort((a, b) => b.value - a.value)
    .map((a) => ({ ...a, value: round(a.value), weight: value ? round((a.value / value) * 100, 1) : 0 }));

  return {
    updatedAt: new Date().toISOString(),
    summary: {
      value: round(value),
      invested: round(invested),
      unrealizedPnl: round(unrealizedPnl),
      realizedPnl: round(realizedPnl),
      totalPnl: round(unrealizedPnl + realizedPnl),
      totalPnlPct: totalCost ? round(((unrealizedPnl + realizedPnl) / totalCost) * 100) : 0,
      dayChange: round(dayChange),
      dayChangePct: value - dayChange ? round((dayChange / (value - dayChange)) * 100) : 0,
      totalInvested: round(totalCost),
      proceeds: round(sum(closed.map((p) => p.value))),
      feesPaid: round(sum(rows.map((r) => r.buy_fees + (r.sell_date ? r.sell_fees : 0)))),
      openCount: open.length,
      closedCount: closed.length,
    },
    positions,
    allocation,
    errors,
  };
}

// ---------- Évolution du portefeuille sur 1 jour / 1 semaine / 1 mois ----------

function createdTs(r: PositionRow): number {
  const t = Date.parse(r.created_at.replace(" ", "T") + "Z");
  return Number.isFinite(t) ? t / 1000 : Infinity;
}

// Instant du dernier point de la série à la date `d` (ou avant) : moment où l'ordre
// passé ce jour-là est considéré exécuté (clôture). -Infinity si `d` précède la série.
function closeTsOf(points: SeriesPoint[], d: string): number {
  let ts = -Infinity;
  for (const p of points) {
    if (p.date <= d) ts = p.t;
    else break;
  }
  return ts;
}

export async function computeTimeline(rows: PositionRow[], period: Period) {
  const series = new Map<string, SeriesPoint[]>();
  const fxs = new Map<string, { points: SeriesPoint[]; current: number }>();
  await Promise.all([
    ...[...new Set(rows.map((r) => r.symbol))].map(async (s) => {
      try {
        series.set(s, (await getSeries(s, period)).points);
      } catch {
        /* instrument indisponible : ignoré dans le graphique */
      }
    }),
    ...[...new Set(rows.map((r) => r.currency))].map(async (c) => {
      try {
        fxs.set(c, await getFxSeries(c, period));
      } catch {
        /* repli sur le taux d'achat */
      }
    }),
  ]);

  // Instants d'entrée / de sortie de chaque position sur l'axe du temps.
  const lots = rows.map((r) => {
    const pts = series.get(r.symbol) ?? [];
    // Achat "aujourd'hui" : à l'heure de saisie ; achat passé : à la clôture du jour d'achat.
    const buyT = Math.min(closeTsOf(pts, r.buy_date), createdTs(r));
    const sellT = r.sell_date ? closeTsOf(pts, r.sell_date) : Infinity;
    const cost = positionCost(r);
    const realized =
      r.sell_date && r.sell_price != null ? r.quantity * r.sell_price * (r.sell_fx ?? 1) - r.sell_fees - cost : 0;
    return { r, pts, buyT, sellT, cost, realized };
  });

  const xs = [...new Set([...series.values()].flatMap((p) => p.map((x) => x.t)))].sort((a, b) => a - b);
  const points: TimelinePoint[] = xs.map((t) => {
    let value = 0;
    let invested = 0;
    let realized = 0;
    for (const l of lots) {
      if (t < l.buyT) continue;
      if (t >= l.sellT) {
        realized += l.realized;
        continue;
      }
      const close = seriesAt(l.pts, t) ?? l.r.buy_price;
      const fx = fxs.get(l.r.currency);
      const rate = fx ? (fx.points.length ? seriesAt(fx.points, t) ?? fx.current : fx.current) : l.r.buy_fx;
      value += l.r.quantity * close * rate;
      invested += l.cost;
    }
    return { t, value: round(value), invested: round(invested), pnl: round(value - invested + realized) };
  });
  // On démarre le graphique au premier instant où une position est détenue.
  const first = points.findIndex((p) => p.invested > 0 || p.pnl !== 0);
  return { period, points: first < 0 ? [] : points.slice(first) };
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export type { PricePoint };
