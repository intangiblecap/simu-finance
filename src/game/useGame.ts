import { useCallback, useMemo, useState } from 'react'
import type { BananaTree, DividendPayment, Player, PriceChange, TurnSummary } from '../types'
import { createInitialTrees } from '../data/trees'
import { advanceTreeSeason, computeDividend } from './priceEngine'

const STARTING_CASH = 20

export interface HoldingView {
  treeId: string
  name: string
  archetype: BananaTree['archetype']
  shares: number
  avgPrice: number
  currentPrice: number
  currentValue: number
  gain: number
  gainPct: number
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function useGame() {
  const [season, setSeason] = useState(0)
  const [trees, setTrees] = useState<BananaTree[]>(() => createInitialTrees())
  const [player, setPlayer] = useState<Player>({ cash: STARTING_CASH, holdings: {} })
  const [lastSummary, setLastSummary] = useState<TurnSummary | null>(null)

  const treesById = useMemo(() => {
    const map = new Map<string, BananaTree>()
    for (const tree of trees) map.set(tree.id, tree)
    return map
  }, [trees])

  const buyShares = useCallback(
    (treeId: string, shares: number) => {
      if (shares <= 0) return
      const tree = treesById.get(treeId)
      if (!tree) return
      const cost = roundMoney(tree.price * shares)
      setPlayer((prev) => {
        if (cost > prev.cash + 1e-9) return prev
        const existing = prev.holdings[treeId] ?? { shares: 0, totalCost: 0 }
        return {
          cash: roundMoney(prev.cash - cost),
          holdings: {
            ...prev.holdings,
            [treeId]: {
              shares: existing.shares + shares,
              totalCost: roundMoney(existing.totalCost + cost),
            },
          },
        }
      })
    },
    [treesById],
  )

  const sellShares = useCallback(
    (treeId: string, shares: number) => {
      if (shares <= 0) return
      const tree = treesById.get(treeId)
      if (!tree) return
      setPlayer((prev) => {
        const existing = prev.holdings[treeId]
        if (!existing || existing.shares < shares) return prev
        const proceeds = roundMoney(tree.price * shares)
        const remainingShares = existing.shares - shares
        const remainingCost = roundMoney(
          existing.totalCost * (remainingShares / existing.shares),
        )
        const holdings = { ...prev.holdings }
        if (remainingShares <= 0) {
          delete holdings[treeId]
        } else {
          holdings[treeId] = { shares: remainingShares, totalCost: remainingCost }
        }
        return { cash: roundMoney(prev.cash + proceeds), holdings }
      })
    },
    [treesById],
  )

  const nextSeason = useCallback(() => {
    const nextSeasonNumber = season + 1
    const changes: PriceChange[] = []
    const dividends: DividendPayment[] = []
    let totalDividends = 0

    const updatedTrees = trees.map((tree) => {
      const holding = player.holdings[tree.id]
      if (holding && holding.shares > 0) {
        const dividend = computeDividend(tree, holding.shares)
        if (dividend > 0) {
          dividends.push({ treeId: tree.id, name: tree.name, amount: dividend })
          totalDividends += dividend
        }
      }
      const updated = advanceTreeSeason(tree, nextSeasonNumber)
      const pctChange = ((updated.price - tree.price) / tree.price) * 100
      changes.push({
        treeId: tree.id,
        name: tree.name,
        oldPrice: tree.price,
        newPrice: updated.price,
        pctChange,
      })
      return updated
    })

    setTrees(updatedTrees)
    if (totalDividends > 0) {
      setPlayer((prev) => ({ ...prev, cash: roundMoney(prev.cash + totalDividends) }))
    }
    setSeason(nextSeasonNumber)
    setLastSummary({ season: nextSeasonNumber, changes, dividends, totalDividends })
  }, [season, trees, player])

  const dismissSummary = useCallback(() => setLastSummary(null), [])

  const holdingsView: HoldingView[] = useMemo(() => {
    return Object.entries(player.holdings)
      .map(([treeId, holding]) => {
        const tree = treesById.get(treeId)
        if (!tree || holding.shares <= 0) return null
        const avgPrice = holding.totalCost / holding.shares
        const currentValue = roundMoney(tree.price * holding.shares)
        const gain = roundMoney(currentValue - holding.totalCost)
        const gainPct = holding.totalCost > 0 ? (gain / holding.totalCost) * 100 : 0
        const view: HoldingView = {
          treeId,
          name: tree.name,
          archetype: tree.archetype,
          shares: holding.shares,
          avgPrice,
          currentPrice: tree.price,
          currentValue,
          gain,
          gainPct,
        }
        return view
      })
      .filter((v): v is HoldingView => v !== null)
  }, [player.holdings, treesById])

  const portfolioValue = useMemo(
    () => holdingsView.reduce((sum, h) => sum + h.currentValue, 0),
    [holdingsView],
  )

  const totalWealth = roundMoney(player.cash + portfolioValue)

  return {
    season,
    trees,
    player,
    holdingsView,
    portfolioValue: roundMoney(portfolioValue),
    totalWealth,
    lastSummary,
    buyShares,
    sellShares,
    nextSeason,
    dismissSummary,
  }
}
