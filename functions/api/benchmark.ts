import { BENCHMARKS, computeBenchmarks } from "../../lib/benchmark";
import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import { currentPortfolio, portfolioRows } from "../../lib/scope";

// Comparaison avec des références : GET /api/benchmark?ids=stoxx600,inflation (par défaut : toutes).
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const param = new URL(request.url).searchParams.get("ids");
    const ids = param ? param.split(",") : BENCHMARKS.map((b) => b.id);
    const pf = await currentPortfolio(env, request);
    return json(await computeBenchmarks(await portfolioRows(env, pf.id), ids));
  } catch (e) {
    return errorResponse(e);
  }
};
