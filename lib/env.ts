export interface Env {
  DB: D1Database;
  // Mot de passe d'accès. S'il n'est pas défini, l'app est accessible sans connexion.
  APP_PASSWORD?: string;
  // Clé de signature des sessions. Optionnelle : dérivée du mot de passe si absente.
  SESSION_SECRET?: string;
  YAHOO_RELAY?: string; // dev uniquement, voir scripts/dev-relay.mjs
}

export const authEnabled = (env: Env): boolean => !!env.APP_PASSWORD;

export function sessionSecret(env: Env): string {
  return env.SESSION_SECRET || `simu-finance:${env.APP_PASSWORD ?? ""}`;
}
