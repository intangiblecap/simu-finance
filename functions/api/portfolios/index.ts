import type { Env } from "../../../lib/env";
import { errorResponse, json, readJson, todayParis } from "../../../lib/http";
import { checkName, checkStart } from "../../../lib/portfolios";

// Liste des portefeuilles (GET) et création (POST {name, startDate}).
export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { results } = await env.DB.prepare(
      `SELECT p.id, p.name, p.start_date AS startDate, COUNT(x.id) AS positions
       FROM portfolios p LEFT JOIN positions x ON x.portfolio_id = p.id
       GROUP BY p.id ORDER BY p.id`,
    ).all();
    return json({ portfolios: results });
  } catch (e) {
    return errorResponse(e);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await readJson<{ name?: string; startDate?: string }>(request);
    const name = checkName(body.name);
    const start = checkStart(body.startDate ?? todayParis());
    const row = await env.DB.prepare("INSERT INTO portfolios (name, start_date) VALUES (?, ?) RETURNING id")
      .bind(name, start)
      .first<{ id: number }>();
    return json({ id: row!.id, name, startDate: start }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
};
