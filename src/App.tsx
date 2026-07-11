import { useGame } from './game/useGame'
import { Header } from './components/Header'
import { TreeCard } from './components/TreeCard'
import { PortfolioPanel } from './components/PortfolioPanel'
import { TurnSummaryModal } from './components/TurnSummaryModal'
import './App.css'

function App() {
  const {
    season,
    trees,
    player,
    holdingsView,
    totalWealth,
    lastSummary,
    buyShares,
    sellShares,
    nextSeason,
    dismissSummary,
  } = useGame()

  const holdingsByTreeId = new Map(holdingsView.map((h) => [h.treeId, h]))

  return (
    <div className="app">
      <Header
        season={season}
        cash={player.cash}
        totalWealth={totalWealth}
        onNextSeason={nextSeason}
      />

      <main className="app-main">
        <section className="grove">
          {trees.map((tree) => (
            <TreeCard
              key={tree.id}
              tree={tree}
              holding={holdingsByTreeId.get(tree.id)}
              cash={player.cash}
              onBuy={buyShares}
              onSell={sellShares}
            />
          ))}
        </section>

        <PortfolioPanel holdings={holdingsView} cash={player.cash} totalWealth={totalWealth} />
      </main>

      {lastSummary && <TurnSummaryModal summary={lastSummary} onClose={dismissSummary} />}
    </div>
  )
}

export default App
