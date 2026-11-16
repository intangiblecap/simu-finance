import { BENCHMARKS, computeBenchmarks } from "../../lib/benchmark";
import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import type { PositionRow } from "../../lib/portfolio";

// Comparaison avec des références : GET /api/benchmark?ids=stoxx600,inflation (par défaut : toutes).
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const param = new URL(request.url).searchParams.get("ids");
    const ids = param ? param.split(",") : BENCHMARKS.map((b) => b.id);
    const { results } = await env.DB.prepare("SELECT * FROM positions ORDER BY buy_date, id").all<PositionRow>();
    return json(await computeBenchmarks(results, ids));
  } catch (e) {
    return errorResponse(e);
  }
};
