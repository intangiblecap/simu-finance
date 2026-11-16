import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import { computePortfolio } from "../../lib/portfolio";
import { currentPortfolio, portfolioRows } from "../../lib/scope";

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const pf = await currentPortfolio(env, request);
    const result = await computePortfolio(await portfolioRows(env, pf.id));
    return json({ ...result, portfolio: { id: pf.id, name: pf.name, startDate: pf.start_date } });
  } catch (e) {
    return errorResponse(e);
  }
};
