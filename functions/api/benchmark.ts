import { DEFAULT_BENCHMARK, computeBenchmark } from "../../lib/benchmark";
import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import type { PositionRow } from "../../lib/portfolio";

// Comparaison avec un indice : GET /api/benchmark?id=stoxx600|cac40|stoxx50|sp500|world|tbill
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const id = new URL(request.url).searchParams.get("id") ?? DEFAULT_BENCHMARK;
    const { results } = await env.DB.prepare("SELECT * FROM positions ORDER BY buy_date, id").all<PositionRow>();
    return json(await computeBenchmark(results, id));
  } catch (e) {
    return errorResponse(e);
  }
};
