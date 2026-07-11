import type { HoldingView } from '../game/useGame'

interface PortfolioPanelProps {
  holdings: HoldingView[]
  cash: number
  totalWealth: number
}

export function PortfolioPanel({ holdings, cash, totalWealth }: PortfolioPanelProps) {
  return (
    <div className="portfolio-panel">
      <h2>Mon patrimoine</h2>
      <div className="portfolio-totals">
        <div>
          <span className="portfolio-total-label">Bananes liquides</span>
          <span className="portfolio-total-value">{cash.toFixed(2)} 🍌</span>
        </div>
        <div>
          <span className="portfolio-total-label">Valeur totale</span>
          <span className="portfolio-total-value">{totalWealth.toFixed(2)} 🍌</span>
        </div>
      </div>

      {holdings.length === 0 ? (
        <p className="portfolio-empty">
          Tu n'as pas encore de branches. Achète-en dans un bananier pour commencer à investir !
        </p>
      ) : (
        <div className="portfolio-table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Bananier</th>
                <th>Branches</th>
                <th>Prix moyen</th>
                <th>Prix actuel</th>
                <th>Valeur</th>
                <th>Gain / Perte</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.treeId}>
                  <td>{h.name}</td>
                  <td>{h.shares}</td>
                  <td>{h.avgPrice.toFixed(2)} 🍌</td>
                  <td>{h.currentPrice.toFixed(2)} 🍌</td>
                  <td>{h.currentValue.toFixed(2)} 🍌</td>
                  <td className={h.gain >= 0 ? 'positive' : 'negative'}>
                    {h.gain >= 0 ? '+' : ''}
                    {h.gain.toFixed(2)} 🍌 ({h.gainPct >= 0 ? '+' : ''}
                    {h.gainPct.toFixed(1)}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
