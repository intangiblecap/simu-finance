import type { Env } from "../../lib/env";
import { errorResponse, json } from "../../lib/http";
import { search } from "../../lib/yahoo";

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  try {
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return json({ results: [] });
    return json({ results: await search(q.slice(0, 60)) });
  } catch (e) {
    return errorResponse(e);
  }
};
