import { ArrowRightIcon, BananaAmount, MonkeyMascot } from './icons'

interface HeaderProps {
  season: number
  cash: number
  totalWealth: number
  onNextSeason: () => void
}

export function Header({ season, cash, totalWealth, onNextSeason }: HeaderProps) {
  return (
    <header className="game-header">
      <div className="game-title">
        <span className="game-title-icon">
          <MonkeyMascot size={48} />
        </span>
        <div>
          <h1>La Savane des Bananiers</h1>
          <p>Apprends les bases de la bourse, une saison à la fois</p>
        </div>
      </div>

      <div className="game-stats">
        <div className="stat">
          <span className="stat-label">Saison</span>
          <span className="stat-value">{season}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Bananes liquides</span>
          <span className="stat-value">
            <BananaAmount value={cash} />
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Patrimoine total</span>
          <span className="stat-value">
            <BananaAmount value={totalWealth} variant="bunch" />
          </span>
        </div>
        <button type="button" className="primary-button next-season-button" onClick={onNextSeason}>
          Saison suivante <ArrowRightIcon size={18} />
        </button>
      </div>
    </header>
  )
}
