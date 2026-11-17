// Liquidité simulée : coût de l'écart achat/vente (« spread ») et impact de l'ordre sur le prix.
// Estimés à partir des volumes et de la volatilité des 20 dernières séances (données Yahoo).

import { Chart, FxSeries, fxAt, round } from "./yahoo";

export const LIQ = {
  window: 20, // séances utilisées pour la moyenne des échanges et la volatilité
  // Écart achat/vente total estimé selon le montant échangé par jour (€) — interpolé en échelle log.
  spreadTable: [
    [1e5, 0.02], // 100 k€/jour → 2 %
    [1e6, 0.008], // 1 M€ → 0,8 %
    [1e7, 0.002], // 10 M€ → 0,2 %
    [1e8, 0.0006], // 100 M€ → 0,06 %
    [1e9, 0.0002], // 1 Md€ → 0,02 %
  ] as [number, number][],
  defaultSpread: 0.002, // si le volume est inconnu
  impactCap: 0.1, // impact maximum : 10 %
  warnParticipation: 0.01, // avertir au-delà de 1 % des échanges du jour
  levels: [
    [1e8, "Très liquide"],
    [1e7, "Liquide"],
    [1e6, "Peu liquide"],
    [0, "Très peu liquide"],
  ] as [number, string][],
};

export interface Liquidity {
  adv: number | null; // montant moyen (médian) échangé par jour, en €
  spread: number; // écart achat/vente total estimé (fraction)
  sigma: number; // volatilité quotidienne (écart-type des variations)
  level: string;
}

export function spreadFor(adv: number | null): number {
  if (!adv || !Number.isFinite(adv)) return LIQ.defaultSpread;
  const t = LIQ.spreadTable;
  if (adv <= t[0][0]) return t[0][1];
  if (adv >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 1; i < t.length; i++) {
    if (adv <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      const k = (Math.log10(adv) - Math.log10(x0)) / (Math.log10(x1) - Math.log10(x0));
      return y0 + (y1 - y0) * k;
    }
  }
  return LIQ.defaultSpread;
}

export function levelFor(adv: number | null): string {
  if (!adv) return "Liquidité inconnue";
  return LIQ.levels.find(([min]) => adv >= min)![1];
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Liquidité à une date : séances précédant cette date (incluse) dans l'historique déjà chargé.
export function liquidityAt(chart: Chart, fx: FxSeries, date: string): Liquidity {
  const pts = chart.points.filter((p) => p.date <= date).slice(-(LIQ.window + 1));
  const turnovers = pts.filter((p) => p.volume).map((p) => p.volume! * p.close * fxAt(fx, p.date));
  const adv = turnovers.length >= 5 ? median(turnovers) : null;
  const rets: number[] = [];
  for (let i = 1; i < pts.length; i++) rets.push(pts[i].close / pts[i - 1].close - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sigma = rets.length > 2 ? Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length) : 0.02;
  return { adv: adv && round(adv, 0), spread: spreadFor(adv), sigma, level: levelFor(adv) };
}

export interface LiquidityCost {
  marketPrice: number; // cours du marché
  execPrice: number; // prix réellement payé (achat) ou reçu (vente)
  spreadPct: number; // demi-écart payé sur cet ordre
  impactPct: number; // impact de l'ordre sur le prix
  costPct: number; // total
  participation: number | null; // part de l'ordre dans les échanges du jour
  warning: boolean;
}

// Prix d'exécution d'un ordre de `orderEur` euros : on paie la moitié de l'écart achat/vente
// plus l'impact (règle de la racine carrée : volatilité × √(ordre ÷ échanges du jour)).
export function applyLiquidity(marketPrice: number, side: "buy" | "sell", orderEur: number, liq: Liquidity): LiquidityCost {
  const half = liq.spread / 2;
  const participation = liq.adv ? orderEur / liq.adv : null;
  const impact = participation ? Math.min(LIQ.impactCap, liq.sigma * Math.sqrt(participation)) : 0;
  const cost = half + impact;
  return {
    marketPrice,
    execPrice: round(side === "buy" ? marketPrice * (1 + cost) : marketPrice * (1 - cost), 6),
    spreadPct: round(half * 100, 4),
    impactPct: round(impact * 100, 4),
    costPct: round(cost * 100, 4),
    participation: participation != null ? round(participation * 100, 4) : null,
    warning: participation != null && participation > LIQ.warnParticipation,
  };
}
