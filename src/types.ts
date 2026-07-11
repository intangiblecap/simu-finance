export type Archetype =
  | 'centenaire'
  | 'startup'
  | 'industrielle'
  | 'labo'
  | 'familiale'

export type RiskLevel = 1 | 2 | 3
export type LiquidityLevel = 1 | 2 | 3

export interface ArchetypeInfo {
  label: string
  tagline: string
  description: string
  risk: RiskLevel
  riskLabel: string
  liquidity: LiquidityLevel
  liquidityLabel: string
}

export interface BananaTree {
  id: string
  name: string
  archetype: Archetype
  totalShares: number
  price: number
  history: number[]
  paysDividend: boolean
  dividendYield: number
}

export interface Holding {
  shares: number
  totalCost: number
}

export interface Player {
  cash: number
  holdings: Record<string, Holding>
}

export interface PriceChange {
  treeId: string
  name: string
  oldPrice: number
  newPrice: number
  pctChange: number
}

export interface DividendPayment {
  treeId: string
  name: string
  amount: number
}

export interface TurnSummary {
  season: number
  changes: PriceChange[]
  dividends: DividendPayment[]
  totalDividends: number
}
