// Accès aux données de marché via les endpoints (non officiels) de Yahoo Finance.

// Un User-Agent de navigateur complet déclenche des 429 chez Yahoo ; celui-ci passe.
const UA = "Mozilla/5.0";

// Durée de mise en cache des réponses Yahoo (secondes).
export const CACHE_TTL = { quotes: 300, intraday: 120, search: 3600 };

// Hôtes Yahoo. YAHOO_RELAY (optionnel, dev uniquement) permet de passer par un relais local
// quand le runtime n'a pas d'accès direct à Internet.
let Q1 = "https://query1.finance.yahoo.com";
let Q2 = "https://query2.finance.yahoo.com";
let EU = "https://ec.europa.eu";
export function configureYahoo(relay?: string) {
  if (relay) {
    const base = relay.replace(/\/$/, "");
    Q1 = `${base}/q1`;
    Q2 = `${base}/q2`;
    EU = `${base}/eu`;
  }
}
// Hôte Eurostat (même mécanisme de relais en développement).
export const eurostatBase = () => EU;

export interface PricePoint {
  date: string; // YYYY-MM-DD (heure locale de la place de cotation)
  close: number;
  volume?: number; // nombre de titres échangés ce jour-là (si connu)
}

export interface Chart {
  symbol: string;
  name: string;
  exchange: string;
  currency: string; // devise de cotation telle que renvoyée par Yahoo (EUR, GBp, CHF...)
  instrumentType: string;
  price: number; // dernier cours connu
  marketTime: number; // timestamp (s) du dernier cours
  points: PricePoint[]; // clôtures journalières, triées par date
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  // Renseigné quand la même société est cotée sur plusieurs bourses.
  listing?: {
    group: string; // identifiant du groupe de cotations d'une même société
    count: number; // nombre de cotations dans les résultats
    role: "primary" | "secondary";
    currency: string;
  };
}

// Places européennes acceptées (suffixe du ticker Yahoo -> libellé).
// L'ordre sert au tri des résultats de recherche (places principales d'abord).
export const EUROPEAN_EXCHANGES: Record<string, string> = {
  PA: "Euronext Paris",
  AS: "Euronext Amsterdam",
  BR: "Euronext Bruxelles",
  LS: "Euronext Lisbonne",
  MI: "Euronext Milan",
  IR: "Euronext Dublin",
  OL: "Oslo",
  DE: "XETRA",
  MC: "Madrid",
  SW: "SIX Suisse",
  L: "Londres",
  ST: "Stockholm",
  CO: "Copenhague",
  HE: "Helsinki",
  VI: "Vienne",
  AT: "Athènes",
  WA: "Varsovie",
  PR: "Prague",
  F: "Francfort",
};

export function exchangeSuffix(symbol: string): string | null {
  const m = symbol.match(/\.([A-Z]{1,3})$/);
  return m ? m[1] : null;
}

export function isEuropean(symbol: string): boolean {
  const s = exchangeSuffix(symbol);
  return !!s && s in EUROPEAN_EXCHANGES;
}

export class MarketDataError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export async function cachedJson(url: string, ttlSeconds: number): Promise<any> {
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  const key = new Request(url);
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return hit.json();
  }
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 404) throw new MarketDataError("Instrument introuvable", 404);
  if (!res.ok) throw new MarketDataError(`Yahoo Finance a répondu ${res.status}`);
  const body = await res.text();
  if (cache) {
    await cache.put(
      key,
      new Response(body, {
        headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${ttlSeconds}` },
      }),
    );
  }
  return JSON.parse(body);
}

function toLocalDate(ts: number, gmtoffset: number): string {
  return new Date((ts + gmtoffset) * 1000).toISOString().slice(0, 10);
}

export type Range = "5d" | "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "10y" | "max";

// Plus petite plage Yahoo couvrant une date donnée (avec une marge).
export function rangeCovering(date: string): Range {
  const days = (Date.now() - Date.parse(date)) / 86_400_000 + 10;
  if (days <= 28) return "1mo";
  if (days <= 88) return "3mo";
  if (days <= 180) return "6mo";
  if (days <= 362) return "1y";
  if (days <= 725) return "2y";
  if (days <= 1820) return "5y";
  if (days <= 3640) return "10y";
  return "max";
}

const RANGE_ORDER: Range[] = ["5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "max"];
export function widestRange(a: Range, b: Range): Range {
  return RANGE_ORDER.indexOf(a) >= RANGE_ORDER.indexOf(b) ? a : b;
}

export async function getChart(symbol: string, range: Range = "1y"): Promise<Chart> {
  // Journalier partout (les calculs à une date précise en ont besoin), sauf "max" en hebdo.
  const iv = range === "max" ? "1wk" : "1d";
  const url =
    `${Q1}/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${iv}&includePrePost=false&events=div%2Csplit`;
  const json = await cachedJson(url, CACHE_TTL.quotes);
  const result = json?.chart?.result?.[0];
  if (!result) {
    const msg = json?.chart?.error?.description;
    throw new MarketDataError(msg ? `Yahoo : ${msg}` : "Instrument introuvable", 404);
  }
  const meta = result.meta ?? {};
  const gmt = meta.gmtoffset ?? 0;
  const ts: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

  const volumes: (number | null)[] = result.indicators?.quote?.[0]?.volume ?? [];
  const perWeek = iv === "1wk" ? 5 : 1; // en hebdomadaire, on ramène le volume à une journée
  const byDate = new Map<string, { c: number; v?: number }>();
  ts.forEach((t, i) => {
    const c = closes[i];
    const v = volumes[i];
    if (c != null && Number.isFinite(c)) byDate.set(toLocalDate(t, gmt), { c, v: v != null && v > 0 ? v / perWeek : undefined });
  });
  // Le dernier cours "live" remplace la clôture du jour en cours.
  if (meta.regularMarketPrice != null && meta.regularMarketTime) {
    const d = toLocalDate(meta.regularMarketTime, gmt);
    byDate.set(d, { c: meta.regularMarketPrice, v: byDate.get(d)?.v });
  }
  const points: PricePoint[] = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, { c, v }]) => (v ? { date, close: round(c, 6), volume: v } : { date, close: round(c, 6) }));

  if (!points.length) throw new MarketDataError("Pas de cotation disponible pour cet instrument", 404);

  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? symbol,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? "",
    currency: meta.currency ?? "EUR",
    instrumentType: meta.instrumentType ?? "",
    price: meta.regularMarketPrice ?? points[points.length - 1].close,
    marketTime: meta.regularMarketTime ?? 0,
    points,
  };
}

// ---------- Séries courtes (graphiques 1 jour / 1 semaine / 1 mois) ----------

export type Period = "1d" | "1w" | "1m";

export interface SeriesPoint {
  t: number; // timestamp (s)
  date: string; // YYYY-MM-DD, heure locale de la place
  close: number;
}

const PERIOD_PARAMS: Record<Period, { range: string; interval: string }> = {
  "1d": { range: "1d", interval: "5m" },
  "1w": { range: "5d", interval: "30m" },
  "1m": { range: "1mo", interval: "1d" },
};

export async function getSeries(symbol: string, period: Period): Promise<{ points: SeriesPoint[]; meta: any }> {
  const { range, interval } = PERIOD_PARAMS[period];
  const url =
    `${Q1}/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}&includePrePost=false`;
  const json = await cachedJson(url, period === "1m" ? CACHE_TTL.quotes : CACHE_TTL.intraday);
  const result = json?.chart?.result?.[0];
  if (!result) throw new MarketDataError("Instrument introuvable", 404);
  const meta = result.meta ?? {};
  const gmt = meta.gmtoffset ?? 0;
  const ts: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const points: SeriesPoint[] = [];
  ts.forEach((t, i) => {
    const c = closes[i];
    if (c == null || !Number.isFinite(c)) return;
    // En journalier, un point par jour (horodaté à minuit UTC de la date locale).
    const date = toLocalDate(t, gmt);
    points.push({ t: interval === "1d" ? Date.parse(date) / 1000 : t, date, close: round(c, 6) });
  });
  // Dernier cours connu.
  if (meta.regularMarketPrice != null && meta.regularMarketTime) {
    const date = toLocalDate(meta.regularMarketTime, gmt);
    const last = points[points.length - 1];
    if (interval === "1d") {
      if (last && last.date === date) last.close = meta.regularMarketPrice;
      else points.push({ t: Date.parse(date) / 1000, date, close: meta.regularMarketPrice });
    } else if (last && meta.regularMarketTime > last.t && last.date === date) {
      points.push({ t: meta.regularMarketTime, date, close: meta.regularMarketPrice });
    }
  }
  return { points, meta };
}

// Série de change EUR par unité de devise sur la période (vide pour l'euro).
export async function getFxSeries(currency: string, period: Period): Promise<{ points: SeriesPoint[]; current: number }> {
  const { iso, factor } = fxBase(currency);
  if (iso === "EUR") return { points: [], current: factor };
  const { points, meta } = await getSeries(`${iso}EUR=X`, period);
  return {
    points: points.map((p) => ({ ...p, close: p.close * factor })),
    current: (meta.regularMarketPrice ?? points[points.length - 1]?.close ?? 1) * factor,
  };
}

// Valeur à l'instant t : dernier point <= t, sinon le premier point.
export function seriesAt(points: SeriesPoint[], t: number): number | null {
  if (!points.length) return null;
  if (t < points[0].t) return points[0].close;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].close;
}

// ---------- Cours de plusieurs actions en une requête (onglet « Découvrir ») ----------

export interface SparkQuote {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  prevClose: number; // clôture de la séance précédente
  changePct: number; // variation sur la dernière séance
  marketTime: number;
  volume: number; // volume échangé sur la dernière séance (en nombre de titres)
  closes: number[]; // cours de la dernière séance (pas de 15 min), pour les mini-graphiques
}

const SPARK_BATCH = 20; // maximum accepté par Yahoo par requête

export async function getSpark(symbols: string[]): Promise<SparkQuote[]> {
  const batches: string[][] = [];
  for (let i = 0; i < symbols.length; i += SPARK_BATCH) batches.push(symbols.slice(i, i + SPARK_BATCH));
  const results = await Promise.all(
    batches.map(async (b) => {
      const url = `${Q1}/v7/finance/spark?symbols=${b.map(encodeURIComponent).join(",")}&range=1d&interval=15m`;
      const json = await cachedJson(url, CACHE_TTL.quotes);
      return (json?.spark?.result ?? []) as any[];
    }),
  );
  const out: SparkQuote[] = [];
  for (const x of results.flat()) {
    const r = x?.response?.[0];
    const m = r?.meta;
    if (!m || m.regularMarketPrice == null) continue;
    const closes = ((r.indicators?.quote?.[0]?.close ?? []) as (number | null)[]).filter(
      (c): c is number => c != null && Number.isFinite(c),
    );
    const prev = m.chartPreviousClose ?? m.previousClose ?? closes[0] ?? m.regularMarketPrice;
    out.push({
      symbol: x.symbol,
      name: m.longName ?? m.shortName ?? x.symbol,
      currency: m.currency ?? "EUR",
      price: m.regularMarketPrice,
      prevClose: prev,
      changePct: prev ? round(((m.regularMarketPrice - prev) / prev) * 100, 2) : 0,
      marketTime: m.regularMarketTime ?? 0,
      volume: m.regularMarketVolume ?? 0,
      closes: closes.map((c) => round(c, 4)),
    });
  }
  return out;
}

export async function search(q: string): Promise<SearchResult[]> {
  const url =
    `${Q2}/v1/finance/search?q=${encodeURIComponent(q)}` +
    `&quotesCount=25&newsCount=0&listsCount=0&enableFuzzyQuery=false&lang=fr-FR&region=FR`;
  const json = await cachedJson(url, CACHE_TTL.search);
  const quotes: any[] = json?.quotes ?? [];
  const order = Object.keys(EUROPEAN_EXCHANGES);
  const results: SearchResult[] = quotes
    .filter((x) => x.quoteType === "EQUITY" && typeof x.symbol === "string" && isEuropean(x.symbol))
    .map((x) => ({
      symbol: x.symbol,
      name: x.longname ?? x.shortname ?? x.symbol,
      exchange: EUROPEAN_EXCHANGES[exchangeSuffix(x.symbol)!] ?? x.exchDisp ?? "",
      type: "stock",
    }));
  results.sort((a, b) => order.indexOf(exchangeSuffix(a.symbol)!) - order.indexOf(exchangeSuffix(b.symbol)!));

  // Saisie directe d'un ticker (ex: "ITX.MC") absent des résultats : on le valide via le graphique.
  const t = q.trim().toUpperCase();
  if (/^[A-Z0-9][A-Z0-9\-]*\.[A-Z]{1,3}$/.test(t) && isEuropean(t) && !results.some((r) => r.symbol === t)) {
    try {
      const c = await getChart(t, "5d");
      if (c.instrumentType === "EQUITY") {
        results.unshift({ symbol: c.symbol, name: c.name, exchange: EUROPEAN_EXCHANGES[exchangeSuffix(t)!], type: "stock" });
      }
    } catch {
      /* ticker inconnu : on ignore */
    }
  }
  return annotateListings(results);
}

// Places où les sociétés étrangères ne sont presque jamais cotées à titre principal.
const SECONDARY_VENUES = new Set(["F", "VI"]);

// Une même société peut apparaître plusieurs fois (cotation principale + cotations secondaires).
// On regroupe ces doublons, on identifie la cotation principale (la plus échangée en euros,
// hors places secondaires) et on la place en tête du groupe.
async function annotateListings(results: SearchResult[]): Promise<SearchResult[]> {
  const keyOf = (r: SearchResult) => shortName(r.name).toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");
  const groups = new Map<string, SearchResult[]>();
  for (const r of results) groups.set(keyOf(r), [...(groups.get(keyOf(r)) ?? []), r]);
  const dup = [...groups.values()].filter((g) => g.length > 1);
  if (!dup.length) return results;

  const quotes = await getSpark(dup.flat().map((r) => r.symbol)).catch(() => [] as SparkQuote[]);
  const bySym = new Map(quotes.map((q) => [q.symbol, q]));
  const fx = new Map<string, number>();
  await Promise.all(
    [...new Set(quotes.map((q) => q.currency))].map(async (c) => fx.set(c, (await getFx(c, "5d").catch(() => null))?.current ?? 0)),
  );

  for (const [key, g] of groups) {
    if (g.length < 2) continue;
    const turnover = (r: SearchResult) => {
      const q = bySym.get(r.symbol);
      return q ? q.volume * q.price * (fx.get(q.currency) ?? 0) : 0;
    };
    const main = g.filter((r) => !SECONDARY_VENUES.has(exchangeSuffix(r.symbol)!));
    const primary = (main.length ? main : g).reduce((a, b) => (turnover(b) > turnover(a) ? b : a));
    for (const r of g) {
      r.listing = {
        group: key,
        count: g.length,
        role: r === primary ? "primary" : "secondary",
        currency: bySym.get(r.symbol)?.currency ?? "",
      };
    }
    // Cotation principale en tête de son groupe, le groupe à la place de sa première cotation.
    g.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : 0));
  }
  const out: SearchResult[] = [];
  const done = new Set<string>();
  for (const r of results) {
    const k = keyOf(r);
    if (done.has(k)) continue;
    done.add(k);
    out.push(...groups.get(k)!);
  }
  return out;
}

// ---------- Devises ----------

export interface FxSeries {
  currency: string;
  points: PricePoint[]; // EUR pour 1 unité de la devise
  current: number;
}

// Normalise la devise Yahoo : GBp (pence) -> GBP / 100, etc.
function fxBase(currency: string): { iso: string; factor: number } {
  if (currency === "GBp" || currency === "GBX") return { iso: "GBP", factor: 0.01 };
  if (currency === "ZAc") return { iso: "ZAR", factor: 0.01 };
  if (currency === "ILA") return { iso: "ILS", factor: 0.01 };
  return { iso: currency.toUpperCase(), factor: 1 };
}

export async function getFx(currency: string, range: Range): Promise<FxSeries> {
  const { iso, factor } = fxBase(currency);
  if (iso === "EUR") return { currency, points: [], current: factor };
  const c = await getChart(`${iso}EUR=X`, range);
  return {
    currency,
    points: c.points.map((p) => ({ date: p.date, close: p.close * factor })),
    current: c.price * factor,
  };
}

// Valeur à une date : dernier point <= date (report du dernier cours connu),
// sinon le premier point disponible.
export function valueAt(points: PricePoint[], date: string): number | null {
  if (!points.length) return null;
  let lo = 0;
  let hi = points.length - 1;
  if (date < points[0].date) return points[0].close;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].date <= date) lo = mid;
    else hi = mid - 1;
  }
  return points[lo].close;
}

export function fxAt(fx: FxSeries, date: string): number {
  if (!fx.points.length) return fx.current;
  return valueAt(fx.points, date) ?? fx.current;
}

// Nom court pour les listes : sans forme juridique (S.A., AG, plc…).
export function shortName(name: string): string {
  return name
    .replace(/\s+-\s+.*$/, "") // « LVMH Moët Hennessy - Louis Vuitton, … » → « LVMH Moët Hennessy »
    .replace(/,?\s+(Société en commandite par actions|Société Européenne|Société Anonyme|S\.?C\.?A\.?)$/i, "")
    .replace(/,?\s+(S\.?A\.?|SE|AG|plc|PLC|N\.?V\.?|A\/S|S\.p\.A\.?|SpA|Société Anonyme|Group|Holding)\.?$/i, "")
    .replace(/,?\s+(S\.?A\.?|SE|AG|plc|N\.?V\.?)\.?$/i, "")
    .trim();
}

export function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
