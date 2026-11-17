-- Coût de liquidité (écart achat/vente + impact) de chaque ordre, en €.
-- Déjà inclus dans buy_price / sell_price ; conservé pour l'affichage.
-- (Appliquée automatiquement par lib/schema.ts.)
ALTER TABLE positions ADD COLUMN buy_liq REAL NOT NULL DEFAULT 0;
ALTER TABLE positions ADD COLUMN sell_liq REAL NOT NULL DEFAULT 0;
