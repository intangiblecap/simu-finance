interface SparklineProps {
  history: number[]
  width?: number
  height?: number
}

export function Sparkline({ history, width = 120, height = 36 }: SparklineProps) {
  if (history.length < 2) {
    return <svg width={width} height={height} className="sparkline" />
  }

  const min = Math.min(...history)
  const max = Math.max(...history)
  const range = max - min || 1
  const stepX = width / (history.length - 1)

  const points = history
    .map((value, index) => {
      const x = index * stepX
      const y = height - ((value - min) / range) * (height - 4) - 2
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const trendUp = history[history.length - 1] >= history[0]

  return (
    <svg
      width={width}
      height={height}
      className={`sparkline ${trendUp ? 'sparkline-up' : 'sparkline-down'}`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline points={points} fill="none" strokeWidth={2} />
    </svg>
  )
}
