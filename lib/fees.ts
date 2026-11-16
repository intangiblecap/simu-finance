// Frais de courtage simulés, calculés automatiquement à chaque ordre (achat et vente).
// Modèle simple inspiré des courtiers en ligne : un pourcentage du montant de l'ordre.
export const FEE_RATE = 0.005; // 0,5 %

export function orderFees(grossEur: number): number {
  return Math.round(grossEur * FEE_RATE * 100) / 100;
}

// Pour un budget total (frais inclus), part réellement investie en actions.
export function netFromBudget(budgetEur: number): { net: number; fees: number } {
  const net = budgetEur / (1 + FEE_RATE);
  const fees = Math.round((budgetEur - net) * 100) / 100;
  return { net: budgetEur - fees, fees };
}
