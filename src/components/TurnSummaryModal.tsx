import type { TurnSummary } from '../types'
import { Banana, BananaAmount, SeasonIcon, TrendDownIcon, TrendFlatIcon, TrendUpIcon } from './icons'

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
        <h2 className="modal-title">
          <SeasonIcon size={28} /> Saison {summary.season}
        </h2>

        <div className="summary-section">
          <h3>
            <TrendUpIcon className="positive" /> En hausse
          </h3>
          {gainers.length === 0 ? (
            <p className="summary-empty">Aucun bananier n'a monté cette saison.</p>
          ) : (
            <ul>
              {gainers.map((c) => (
                <li key={c.treeId} className="positive">
                  {c.name} : {c.oldPrice.toFixed(2)} → <BananaAmount value={c.newPrice} /> (+
                  {c.pctChange.toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="summary-section">
          <h3>
            <TrendDownIcon className="negative" /> En baisse
          </h3>
          {losers.length === 0 ? (
            <p className="summary-empty">Aucun bananier n'a baissé cette saison.</p>
          ) : (
            <ul>
              {losers.map((c) => (
                <li key={c.treeId} className="negative">
                  {c.name} : {c.oldPrice.toFixed(2)} → <BananaAmount value={c.newPrice} /> (
                  {c.pctChange.toFixed(1)}%)
                </li>
              ))}
            </ul>
          )}
        </div>

        {flat.length > 0 && (
          <div className="summary-section">
            <h3>
              <TrendFlatIcon /> Stables
            </h3>
            <ul>
              {flat.map((c) => (
                <li key={c.treeId}>
                  {c.name} : <BananaAmount value={c.newPrice} /> (inchangé)
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="summary-section">
          <h3>
            <Banana size={18} /> Dividendes reçus
          </h3>
          {summary.dividends.length === 0 ? (
            <p className="summary-empty">Aucun dividende ce tour-ci.</p>
          ) : (
            <>
              <ul>
                {summary.dividends.map((d) => (
                  <li key={d.treeId}>
                    {d.name} t'a versé <BananaAmount value={d.amount} />
                  </li>
                ))}
              </ul>
              <p className="summary-total">
                Total touché : <strong><BananaAmount value={summary.totalDividends} /></strong>
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
