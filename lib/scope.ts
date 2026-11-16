// Portefeuille courant : choisi par l'interface via l'en-tête X-Portfolio-Id
// (à défaut, le premier portefeuille).
import type { Env } from "./env";
import type { PositionRow } from "./portfolio";

export interface PortfolioRow {
  id: number;
  name: string;
  start_date: string;
  created_at: string;
}

export async function currentPortfolio(env: Env, request: Request): Promise<PortfolioRow> {
  const id = Number(request.headers.get("X-Portfolio-Id"));
  if (Number.isInteger(id) && id > 0) {
    const p = await env.DB.prepare("SELECT * FROM portfolios WHERE id = ?").bind(id).first<PortfolioRow>();
    if (p) return p;
  }
  return (await env.DB.prepare("SELECT * FROM portfolios ORDER BY id LIMIT 1").first<PortfolioRow>())!;
}

export async function portfolioRows(env: Env, portfolioId: number): Promise<PositionRow[]> {
  const { results } = await env.DB.prepare("SELECT * FROM positions WHERE portfolio_id = ? ORDER BY buy_date, id")
    .bind(portfolioId)
    .all<PositionRow>();
  return results;
}
