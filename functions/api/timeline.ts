import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import { computeTimeline } from "../../lib/portfolio";
import { currentPortfolio, portfolioRows } from "../../lib/scope";
import type { Period } from "../../lib/yahoo";

const PERIODS: Period[] = ["1d", "1w", "1m"];

// Évolution du portefeuille : ?period=1d (5 min) | 1w (30 min) | 1m (journalier)
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const p = new URL(request.url).searchParams.get("period") as Period | null;
    const period: Period = p && PERIODS.includes(p) ? p : "1m";
    const pf = await currentPortfolio(env, request);
    return json(await computeTimeline(await portfolioRows(env, pf.id), period));
  } catch (e) {
    return errorResponse(e);
  }
};
