import type { TurnSummary } from '../types'

interface TurnSummaryModalProps {
  summary: TurnSummary
  onClose: () => void
}

export function TurnSummaryModal({ summary, onClose }: TurnSummaryModalProps) {
  const gainers = summary.changes.filter((c) => c.pctChange > 0)
  const losers = summary.changes.filter((c) => c.pctChange < 0)
  const flat = summary.changes.filter((c) => c.pctChange === 0)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>🌤️ Saison {summary.season}</h2>

        <div className="summary-section">
          <h3>📈 En hausse</h3>
          {gainers.length === 0 ? (
            <p className="summary-empty">Aucun bananier n'a monté cette saison.</p>
          ) : (
            <ul>
              {gainers.map((c) => (
                <li key={c.treeId} className="positive">
                  {c.name} : {c.oldPrice.toFixed(2)} → {c.newPrice.toFixed(2)} 🍌 (+
                  {c.pctChange.toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="summary-section">
          <h3>📉 En baisse</h3>
          {losers.length === 0 ? (
            <p className="summary-empty">Aucun bananier n'a baissé cette saison.</p>
          ) : (
            <ul>
              {losers.map((c) => (
                <li key={c.treeId} className="negative">
                  {c.name} : {c.oldPrice.toFixed(2)} → {c.newPrice.toFixed(2)} 🍌 (
                  {c.pctChange.toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </div>

        {flat.length > 0 && (
          <div className="summary-section">
            <h3>➖ Stables</h3>
            <ul>
              {flat.map((c) => (
                <li key={c.treeId}>{c.name} : {c.newPrice.toFixed(2)} 🍌 (inchangé)</li>
              ))}
            </ul>
          </div>
        )}

        <div className="summary-section">
          <h3>🍌 Dividendes reçus</h3>
          {summary.dividends.length === 0 ? (
            <p className="summary-empty">Aucun dividende ce tour-ci.</p>
          ) : (
            <>
              <ul>
                {summary.dividends.map((d) => (
                  <li key={d.treeId}>
                    {d.name} t'a versé {d.amount.toFixed(2)} 🍌
                  </li>
                ))}
              </ul>
              <p className="summary-total">
                Total touché : <strong>{summary.totalDividends.toFixed(2)} 🍌</strong>
              </p>
            </>
          )}
        </div>

        <button type="button" className="primary-button" onClick={onClose}>
          Continuer
        </button>
      </div>
    </div>
  )
}
