import type { BananaTree } from '../types'

const MIN_PRICE = 0.2
const HISTORY_LENGTH = 15

/** Standard normal random value via Box-Muller. */
function gaussianRandom(): number {
  const u1 = Math.max(Math.random(), Number.EPSILON)
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function clampPrice(price: number): number {
  return Math.max(MIN_PRICE, Math.round(price * 100) / 100)
}

function nextPriceFactor(tree: BananaTree, season: number): number {
  switch (tree.archetype) {
    case 'centenaire': {
      const drift = 0.005
      const sigma = 0.04
      return 1 + drift + sigma * gaussianRandom()
    }
    case 'startup': {
      const drift = -0.01
      const sigma = 0.3
      return 1 + drift + sigma * gaussianRandom()
    }
    case 'industrielle': {
      const period = 6
      const amplitude = 0.06
      const cycle = amplitude * Math.sin((2 * Math.PI * season) / period)
      const sigma = 0.06
      return 1 + cycle + sigma * gaussianRandom()
    }
    case 'labo': {
      const sigma = 0.15
      const jumpChance = 0.18
      if (Math.random() < jumpChance) {
        const jumpSign = Math.random() < 0.5 ? -1 : 1
        const jumpSize = 0.4 + Math.random() * 0.3
        return 1 + jumpSign * jumpSize
      }
      return 1 + sigma * gaussianRandom()
    }
    case 'familiale': {
      const movesThisSeason = Math.random() < 0.4
      if (!movesThisSeason) return 1
      const sigma = 0.02
      return 1 + sigma * gaussianRandom()
    }
    default:
      return 1
  }
}

export function advanceTreeSeason(tree: BananaTree, season: number): BananaTree {
  const factor = nextPriceFactor(tree, season)
  const newPrice = clampPrice(tree.price * factor)
  const history = [...tree.history, newPrice].slice(-HISTORY_LENGTH)
  return { ...tree, price: newPrice, history }
}

export function computeDividend(tree: BananaTree, shares: number): number {
  if (!tree.paysDividend || shares <= 0) return 0
  return Math.round(tree.price * tree.dividendYield * shares * 100) / 100
}
