// Mise à jour automatique du schéma D1 au premier appel (une fois par instance),
// pour ne pas avoir de SQL à exécuter à la main lors des évolutions.

let ready: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
  ready ??= migrate(db).catch((e) => {
    ready = null; // on réessaiera au prochain appel
    throw e;
  });
  return ready;
}

async function migrate(db: D1Database) {
  // 0002 : portefeuilles multiples.
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS portfolios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
    )
    .run();
  const cols = await db.prepare("PRAGMA table_info(positions)").all<{ name: string }>();
  if (!cols.results.some((c) => c.name === "portfolio_id")) {
    await db.batch([
      db.prepare(
        `INSERT INTO portfolios (id, name, start_date)
         SELECT 1, 'Mon portefeuille', COALESCE((SELECT MIN(buy_date) FROM positions), date('now'))
         WHERE NOT EXISTS (SELECT 1 FROM portfolios)`,
      ),
      db.prepare("ALTER TABLE positions ADD COLUMN portfolio_id INTEGER NOT NULL DEFAULT 1"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id)"),
    ]);
  }
  // Toujours au moins un portefeuille.
  await db
    .prepare(
      `INSERT INTO portfolios (name, start_date)
       SELECT 'Mon portefeuille', date('now') WHERE NOT EXISTS (SELECT 1 FROM portfolios)`,
    )
    .run();
}
