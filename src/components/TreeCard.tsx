import { useState } from 'react'
import type { BananaTree } from '../types'
import type { HoldingView } from '../game/useGame'
import { ARCHETYPES } from '../data/archetypes'
import { Sparkline } from './Sparkline'
import { ArchetypeIcon, Banana, BananaAmount, BranchesIcon, LiquidityMeter, RiskMeter } from './icons'

interface TreeCardProps {
  tree: BananaTree
  holding?: HoldingView
  cash: number
  onBuy: (treeId: string, shares: number) => void
  onSell: (treeId: string, shares: number) => void
}

export function TreeCard({ tree, holding, cash, onBuy, onSell }: TreeCardProps) {
  const [quantity, setQuantity] = useState(1)
  const [showInfo, setShowInfo] = useState(false)
  const info = ARCHETYPES[tree.archetype]

  const cost = Math.round(tree.price * quantity * 100) / 100
  const canBuy = quantity > 0 && cost <= cash + 1e-9
  const ownedShares = holding?.shares ?? 0
  const canSell = quantity > 0 && quantity <= ownedShares

  const gainClass = holding ? (holding.gain >= 0 ? 'positive' : 'negative') : ''
  const marketCap = Math.round(tree.totalShares * tree.price * 100) / 100

  return (
    <div className="tree-card">
      <div className="tree-card-header">
        <span className={`tree-icon-badge badge-${tree.archetype}`}>
          <ArchetypeIcon archetype={tree.archetype} size={26} />
        </span>
        <div>
          <h3>{tree.name}</h3>
          <span className="tree-archetype">{info.label}</span>
        </div>
      </div>

      <p className="tree-tagline">{info.tagline}</p>

      <button
        type="button"
        className="link-button"
        onClick={() => setShowInfo((v) => !v)}
      >
        {showInfo ? 'Masquer les explications' : 'En savoir plus'}
      </button>
      {showInfo && <p className="tree-description">{info.description}</p>}

      <div className="tree-price-row">
        <div>
          <span className="price-value">
            <BananaAmount value={tree.price} />
          </span>
          <span className="price-label">prix de la branche</span>
        </div>
        <Sparkline history={tree.history} />
      </div>

      <div className="tree-facts">
        <div className="tree-fact">
          <span className="tree-fact-label">
            Bananes qui poussent
            <span className="tree-fact-sublabel">(valeur de l'entreprise)</span>
          </span>
          <span className="tree-fact-value">
            <BananaAmount value={marketCap} variant="bunch" />
          </span>
        </div>
        <div className="tree-fact">
          <span className="tree-fact-label">Branches en circulation</span>
          <span className="tree-fact-value">
            <BranchesIcon /> {tree.totalShares}
          </span>
        </div>
        <div className="tree-fact">
          <span className="tree-fact-label">Risque</span>
          <span className="tree-fact-value">
            <RiskMeter level={info.risk} /> {info.riskLabel}
          </span>
        </div>
        <div className="tree-fact">
          <span className="tree-fact-label">Liquidité</span>
          <span className="tree-fact-value">
            <LiquidityMeter level={info.liquidity} /> {info.liquidityLabel}
          </span>
        </div>
      </div>

      {holding && (
        <div className="tree-holding">
          <span>
            Tu possèdes <strong>{holding.shares}</strong> branche(s), achetées en moyenne à{' '}
            <BananaAmount value={holding.avgPrice} />
          </span>
          <span className={gainClass}>
            <BananaAmount value={holding.gain} showSign /> ({holding.gainPct >= 0 ? '+' : ''}
            {holding.gainPct.toFixed(1)}%)
          </span>
        </div>
      )}

      <div className="tree-trade">
        <label>
          Quantité
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
        <div className="tree-trade-buttons">
          <button
            type="button"
            className="buy-button"
            disabled={!canBuy}
            onClick={() => onBuy(tree.id, quantity)}
            title={`Coûte ${cost.toFixed(2)} bananes`}
          >
            Acheter ({cost.toFixed(2)} <Banana />)
          </button>
          <button
            type="button"
            className="sell-button"
            disabled={!canSell}
            onClick={() => onSell(tree.id, quantity)}
          >
            Vendre
          </button>
        </div>
      </div>
    </div>
  )
}
