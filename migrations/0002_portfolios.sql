-- Plusieurs portefeuilles, chacun avec une date de démarrage.
-- (Appliquée automatiquement au démarrage par lib/schema.ts ; ce fichier sert de référence
--  et pour `wrangler d1 migrations apply`.)
CREATE TABLE IF NOT EXISTS portfolios (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  start_date TEXT NOT NULL,                       -- YYYY-MM-DD
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO portfolios (id, name, start_date)
  SELECT 1, 'Mon portefeuille', COALESCE((SELECT MIN(buy_date) FROM positions), date('now'))
  WHERE NOT EXISTS (SELECT 1 FROM portfolios);
ALTER TABLE positions ADD COLUMN portfolio_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);
