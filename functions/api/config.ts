import type { Env } from "../../lib/env";
import { SIM_CONFIG } from "../../lib/fees";
import { json } from "../../lib/http";
import { CACHE_TTL, EUROPEAN_EXCHANGES } from "../../lib/yahoo";

// Paramètres de simulation, affichés dans l'onglet « Méthode ».
export const onRequestGet: PagesFunction<Env> = async () =>
  json({
    ...SIM_CONFIG,
    exchanges: Object.entries(EUROPEAN_EXCHANGES).map(([suffix, name]) => ({ suffix, name })),
    cacheSeconds: CACHE_TTL,
  });
