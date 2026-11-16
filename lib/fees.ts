// Paramètres de simulation des ordres. Ces valeurs sont exposées par /api/config
// et affichées dans l'onglet « Méthode » de l'app : les modifier ici suffit.

// Frais de courtage : pourcentage du montant de chaque ordre (achat et vente).
export const FEE_RATE = 0.005; // 0,5 %
// Montant minimum d'un achat en euros (frais inclus).
export const MIN_ORDER_EUR = 1;
// Précision des fractions d'actions (nombre de décimales, arrondi à l'inférieur).
export const QTY_DECIMALS = 6;

export const SIM_CONFIG = {
  feeRate: FEE_RATE,
  minOrderEur: MIN_ORDER_EUR,
  qtyDecimals: QTY_DECIMALS,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

// Frais d'un ordre de montant brut `grossEur` (arrondis au centime).
export function orderFees(grossEur: number): number {
  return round2(grossEur * FEE_RATE);
}

// Pour un budget total (frais inclus) : part investie en actions et frais.
// net + net × taux = budget  ⇒  net = budget / (1 + taux)
export function netFromBudget(budgetEur: number): { net: number; fees: number } {
  const fees = round2(budgetEur - budgetEur / (1 + FEE_RATE));
  return { net: budgetEur - fees, fees };
}

export function floorQty(q: number): number {
  const f = 10 ** QTY_DECIMALS;
  return Math.floor(q * f) / f;
}
