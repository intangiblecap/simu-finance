import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import { PositionRow, computePortfolio } from "../../lib/portfolio";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { results } = await env.DB.prepare("SELECT * FROM positions ORDER BY buy_date, id").all<PositionRow>();
    return json(await computePortfolio(results));
  } catch (e) {
    return errorResponse(e);
  }
};
