export interface Env {
  DB: D1Database;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
  YAHOO_RELAY?: string; // dev uniquement, voir scripts/dev-relay.mjs
}
