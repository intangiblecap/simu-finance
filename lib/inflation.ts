// Inflation : indice des prix à la consommation harmonisé (IPCH) de la France, publié
// chaque mois par Eurostat (série prc_hicp_minr, base 100 en 2015).

import { PricePoint, cachedJson, eurostatBase, round } from "./yahoo";

const EUROSTAT_PATH = "/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr?geo=FR&coicop18=TOTAL&unit=I15";

export const INFLATION_CACHE_SECONDS = 86_400; // publication mensuelle : un jour de cache suffit

export interface InflationSeries {
  monthly: { month: string; index: number }[];
  lastPublished: string; // dernier mois publié (YYYY-MM)
  extrapolatedMonthlyRate: number; // hausse mensuelle moyenne des 12 derniers mois, utilisée après le dernier mois publié
  daily: PricePoint[]; // indice interpolé jour par jour
}

const dayMs = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export async function getInflation(fromDate: string, toDate: string): Promise<InflationSeries> {
  // Au moins 15 mois d'historique : il en faut 12 publiés pour prolonger la série, même
  // quand le premier achat est récent (la publication a environ 1 mois et demi de retard).
  const sinceT = Math.min(Date.parse(fromDate) - 62 * dayMs, Date.parse(toDate) - 460 * dayMs);
  const since = new Date(sinceT).toISOString().slice(0, 7);
  const json = await cachedJson(`${eurostatBase()}${EUROSTAT_PATH}&sinceTimePeriod=${since}`, INFLATION_CACHE_SECONDS);
  const idx: Record<string, number> = json?.dimension?.time?.category?.index ?? {};
  const byPos = new Map(Object.entries(idx).map(([m, i]) => [i, m]));
  const monthly = Object.entries(json?.value ?? {})
    .map(([i, v]) => ({ month: byPos.get(Number(i))!, index: Number(v) }))
    .filter((x) => x.month && Number.isFinite(x.index))
    .sort((a, b) => (a.month < b.month ? -1 : 1));
  if (monthly.length < 2) throw new Error("Données d'inflation indisponibles");

  const last = monthly[monthly.length - 1];
  const yearAgo = monthly[Math.max(0, monthly.length - 13)];
  const months = monthly.length - 1 - monthly.indexOf(yearAgo);
  const rate = months > 0 ? (last.index / yearAgo.index) ** (1 / months) - 1 : 0;

  // L'indice d'un mois est daté au 15 ; interpolation linéaire entre deux mois,
  // puis prolongement au rythme moyen des 12 derniers mois.
  const anchors = monthly.map((m) => ({ t: Date.parse(`${m.month}-15`), v: m.index }));
  const lastT = anchors[anchors.length - 1].t;
  const end = Date.parse(toDate);
  const start = Math.min(Date.parse(fromDate), anchors[0].t);
  const daily: PricePoint[] = [];
  let k = 0;
  for (let t = start; t <= end; t += dayMs) {
    let v: number;
    if (t <= anchors[0].t) v = anchors[0].v;
    else if (t >= lastT) v = anchors[anchors.length - 1].v * (1 + rate) ** ((t - lastT) / (30.4375 * dayMs));
    else {
      while (anchors[k + 1].t < t) k++;
      const a = anchors[k];
      const b = anchors[k + 1];
      v = a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
    }
    daily.push({ date: iso(t), close: round(v, 4) });
  }
  return { monthly, lastPublished: last.month, extrapolatedMonthlyRate: rate, daily };
}
