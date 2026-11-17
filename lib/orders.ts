// Calcul d'un ordre simulé : prix du marché, coût de liquidité, frais, quantité.
// Partagé par l'achat, la vente et « Remonter le temps ».

import { floorQty, netFromBudget, orderFees } from "./fees";
import { HttpError } from "./http";
import { Liquidity, LiquidityCost, applyLiquidity, liquidityAt } from "./liquidity";
import { Execution, executionAt } from "./portfolio";
import { Chart, FxSeries, round } from "./yahoo";

export interface OrderQuote {
  exec: Execution; // date et cours du marché retenus
  liq: Liquidity;
  lc: LiquidityCost;
  quantity: number;
  execPrice: number; // prix réellement payé / reçu (cours ± liquidité)
  liquidityCost: number; // coût de liquidité en €
  fees: number;
}

// Vue publique d'un ordre, renvoyée à l'interface.
export function liquidityView(o: OrderQuote) {
  return {
    level: o.liq.level,
    adv: o.liq.adv,
    spreadPct: o.lc.spreadPct,
    impactPct: o.lc.impactPct,
    costPct: o.lc.costPct,
    costEur: o.liquidityCost,
    participation: o.lc.participation,
    warning: o.lc.warning,
  };
}

// Achat : par budget total (frais compris) ou par quantité.
export function buyQuote(chart: Chart, fx: FxSeries, date: string, req: { amount?: number; quantity?: number }): OrderQuote {
  const exec = executionAt(chart, fx, date);
  const liq = liquidityAt(chart, fx, exec.date);
  let quantity: number;
  let fees: number;
  let lc: LiquidityCost;
  if (req.amount != null) {
    const split = netFromBudget(req.amount);
    fees = split.fees;
    lc = applyLiquidity(exec.price, "buy", split.net, liq);
    quantity = floorQty(split.net / (lc.execPrice * exec.fx));
  } else {
    quantity = floorQty(Number(req.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new HttpError(400, "Quantité invalide");
    lc = applyLiquidity(exec.price, "buy", quantity * exec.price * exec.fx, liq);
    fees = orderFees(quantity * lc.execPrice * exec.fx);
  }
  if (quantity <= 0) throw new HttpError(400, "Montant trop faible");
  return {
    exec,
    liq,
    lc,
    quantity,
    execPrice: lc.execPrice,
    liquidityCost: round(quantity * (lc.execPrice - exec.price) * exec.fx),
    fees,
  };
}

export function sellQuote(chart: Chart, fx: FxSeries, date: string, quantity: number): OrderQuote {
  const exec = executionAt(chart, fx, date);
  const liq = liquidityAt(chart, fx, exec.date);
  const lc = applyLiquidity(exec.price, "sell", quantity * exec.price * exec.fx, liq);
  return {
    exec,
    liq,
    lc,
    quantity,
    execPrice: lc.execPrice,
    liquidityCost: round(quantity * (exec.price - lc.execPrice) * exec.fx),
    fees: orderFees(quantity * lc.execPrice * exec.fx),
  };
}
