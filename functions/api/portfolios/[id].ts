import type { Env } from "../../../lib/env";
import { HttpError, errorResponse, json, readJson } from "../../../lib/http";
import { checkName, checkStart } from "../../../lib/portfolios";

async function exists(env: Env, id: number) {
  const p = await env.DB.prepare("SELECT id FROM portfolios WHERE id = ?").bind(id).first();
  if (!p) throw new HttpError(404, "Portefeuille introuvable");
}

// Renommer / changer la date de démarrage (PATCH {name?, startDate?}).
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  try {
    const id = Number(params.id);
    await exists(env, id);
    const body = await readJson<{ name?: string; startDate?: string }>(request);
    if (body.name !== undefined) {
      await env.DB.prepare("UPDATE portfolios SET name = ? WHERE id = ?").bind(checkName(body.name), id).run();
    }
    if (body.startDate !== undefined) {
      const start = checkStart(body.startDate);
      const first = await env.DB.prepare("SELECT MIN(buy_date) AS d FROM positions WHERE portfolio_id = ?")
        .bind(id)
        .first<{ d: string | null }>();
      if (first?.d && first.d < start) {
        throw new HttpError(400, `Ce portefeuille contient un achat du ${first.d} : la date de démarrage ne peut pas être postérieure`);
      }
      await env.DB.prepare("UPDATE portfolios SET start_date = ? WHERE id = ?").bind(start, id).run();
    }
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};

// Supprimer un portefeuille et toutes ses positions (il doit en rester au moins un).
export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  try {
    const id = Number(params.id);
    await exists(env, id);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM portfolios").first<{ n: number }>();
    if ((count?.n ?? 0) <= 1) throw new HttpError(400, "Impossible de supprimer le dernier portefeuille");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM positions WHERE portfolio_id = ?").bind(id),
      env.DB.prepare("DELETE FROM portfolios WHERE id = ?").bind(id),
    ]);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
};
