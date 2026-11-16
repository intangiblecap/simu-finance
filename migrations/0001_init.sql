-- Chaque ligne = un achat simulé (un "lot"). Une vente simulée clôture le lot.
CREATE TABLE positions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  instrument_type TEXT    NOT NULL DEFAULT 'stock', -- prévu pour ETF, crypto, obligations...
  symbol          TEXT    NOT NULL,                 -- ticker Yahoo (ex: TTE.PA)
  name            TEXT    NOT NULL,
  exchange        TEXT,
  currency        TEXT    NOT NULL,                 -- devise de cotation Yahoo (EUR, GBp, CHF...)
  quantity        REAL    NOT NULL,
  buy_date        TEXT    NOT NULL,                 -- YYYY-MM-DD (jour de bourse effectif)
  buy_price       REAL    NOT NULL,                 -- dans la devise de cotation
  buy_fx          REAL    NOT NULL DEFAULT 1,       -- valeur en EUR d'une unité de la devise de cotation
  buy_fees        REAL    NOT NULL DEFAULT 0,       -- en EUR
  sell_date       TEXT,
  sell_price      REAL,
  sell_fx         REAL,
  sell_fees       REAL    NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_positions_symbol ON positions(symbol);
