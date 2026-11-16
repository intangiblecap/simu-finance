import { BENCHMARKS, DEFAULT_BENCHMARK } from "../../lib/benchmark";
import type { Env } from "../../lib/env";
import { SIM_CONFIG } from "../../lib/fees";
import { json } from "../../lib/http";
import { FEATURED, TREND_TOP_N, TREND_UNIVERSE } from "../../lib/universe";
import { CACHE_TTL, EUROPEAN_EXCHANGES } from "../../lib/yahoo";

// Paramètres de simulation, affichés dans l'onglet « Méthode ».
export const onRequestGet: PagesFunction<Env> = async () =>
  json({
    ...SIM_CONFIG,
    exchanges: Object.entries(EUROPEAN_EXCHANGES).map(([suffix, name]) => ({ suffix, name })),
    cacheSeconds: CACHE_TTL,
    trendUniverseSize: new Set(TREND_UNIVERSE).size,
    trendTopN: TREND_TOP_N,
    featured: FEATURED,
    benchmarks: BENCHMARKS.map(({ id, name, short, description, kind, group }) => ({ id, name, short, description, kind, group })),
    defaultBenchmark: DEFAULT_BENCHMARK,
  });
