interface IconProps {
  size?: number
  className?: string
}

/**
 * Small currency glyph used inline next to a single amount: one thick curved
 * banana bar. Deliberately a single stroke, so it never gets mistaken for the
 * multi-bar BananaBunch used for aggregate totals.
 */
export function Banana({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      style={{ verticalAlign: '-3px', flexShrink: 0 }}
    >
      <path
        d="M5.5 19 Q6 7.5 17.5 5"
        fill="none"
        stroke="#ffc94a"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="17.5" cy="5" r="1.9" fill="#8a6a2f" />
    </svg>
  )
}

/**
 * A hand of bananas fanning from a shared stem — used for aggregate/total
 * amounts (patrimoine, capitalisation, valeur d'une ligne). Three bars
 * radiating from one point reads unambiguously as "more than one", unlike
 * the single-bar Banana used for liquid cash and per-unit prices.
 */
export function BananaBunch({ size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * 20) / 26}
      viewBox="0 0 26 20"
      className={className}
      aria-hidden="true"
      style={{ verticalAlign: '-4px', flexShrink: 0 }}
    >
      <path d="M13 3 Q6 6 4 17" fill="none" stroke="#e6a72e" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M13 3 Q13 10 13 18" fill="none" stroke="#ffd668" strokeWidth="4.2" strokeLinecap="round" />
      <path d="M13 3 Q20 6 22 17" fill="none" stroke="#ffc94a" strokeWidth="4.2" strokeLinecap="round" />
      <circle cx="13" cy="3" r="2.3" fill="#8a6a2f" />
    </svg>
  )
}

/** A small forked twig — represents the branches a company has in circulation. */
export function BranchesIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      style={{ verticalAlign: '-3px', flexShrink: 0 }}
    >
      <path
        d="M12 21V9M12 9C7 9 6 6 6.5 3M12 9c5 0 6-3 5.5-6"
        fill="none"
        stroke="#7a5230"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse cx="6" cy="3.4" rx="2.6" ry="1.7" fill="#4c9a5b" transform="rotate(-28 6 3.4)" />
      <ellipse cx="18" cy="3.4" rx="2.6" ry="1.7" fill="#4c9a5b" transform="rotate(28 18 3.4)" />
    </svg>
  )
}

const RISK_COLORS = ['#4c9a5b', '#e6a72e', '#c0392b']
const LIQUIDITY_COLOR = '#2f8f8f'

/** Three-segment gauge: how much a tree's price swings from one season to the next. */
export function RiskMeter({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="meter" role="img" aria-label={`Risque ${level}/3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="meter-bar"
          style={{ background: i <= level ? RISK_COLORS[level - 1] : undefined }}
        />
      ))}
    </span>
  )
}

/** Three-segment gauge: how easily branches of this tree change hands. */
export function LiquidityMeter({ level }: { level: 1 | 2 | 3 }) {
  return (
    <span className="meter" role="img" aria-label={`Liquidité ${level}/3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="meter-bar"
          style={{ background: i <= level ? LIQUIDITY_COLOR : undefined }}
        />
      ))}
    </span>
  )
}

/** Monkey mascot used in the header. */
export function MonkeyMascot({ size = 44, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <circle cx="24" cy="26" r="16" fill="#8a5a3b" />
      <circle cx="8" cy="20" r="6" fill="#8a5a3b" />
      <circle cx="40" cy="20" r="6" fill="#8a5a3b" />
      <circle cx="8" cy="20" r="3.2" fill="#f2d7b6" />
      <circle cx="40" cy="20" r="3.2" fill="#f2d7b6" />
      <ellipse cx="24" cy="29" rx="11" ry="9.5" fill="#f2d7b6" />
      <circle cx="19" cy="26" r="2.1" fill="#3a2e1f" />
      <circle cx="29" cy="26" r="2.1" fill="#3a2e1f" />
      <path
        d="M19.5 33c1.5 1.4 7.5 1.4 9 0"
        fill="none"
        stroke="#3a2e1f"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M22 30.5c.7.6 1.3.6 2 0" fill="none" stroke="#6b4a30" strokeWidth="1" />
    </svg>
  )
}

/** Bananeraie centenaire — tall, layered, heavy-laden canopy. */
export function TreeCentenaireIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="21" y="26" width="6" height="16" rx="2" fill="#7a5230" />
      <ellipse cx="24" cy="20" rx="17" ry="12" fill="#2f6b3c" />
      <ellipse cx="15" cy="16" rx="10" ry="7.5" fill="#3f8a4f" />
      <ellipse cx="33" cy="17" rx="9" ry="7" fill="#3f8a4f" />
      <path d="M18 30c-1 3-1 5 0 7" stroke="#ffc94a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M30 30c1 3 1 5 0 7" stroke="#ffc94a" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/** Jeune pousse — a slender, ambitious sprout. */
export function SproutIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <ellipse cx="24" cy="41" rx="14" ry="4" fill="#dfe9c8" />
      <path
        d="M24 41V20"
        stroke="#3f8a4f"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M24 24c0-7 5-11 11-12-.5 6-4.5 10.5-11 12z"
        fill="#7bc47f"
      />
      <path
        d="M24 29c0-6-4.5-9.5-10-10.5.5 5.5 4 9.5 10 10.5z"
        fill="#4c9a5b"
      />
    </svg>
  )
}

/** Bananeraie industrielle — uniform rows on a plotted field. */
export function PlantationIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="4" y="30" width="40" height="10" rx="1.5" fill="#c9a86a" />
      <path d="M4 35h40M12 30v10M24 30v10M36 30v10" stroke="#b3924f" strokeWidth="1.2" />
      {[10, 24, 38].map((x) => (
        <g key={x}>
          <rect x={x - 1.6} y="19" width="3.2" height="12" fill="#7a5230" />
          <ellipse cx={x} cy="15" rx="8" ry="7" fill="#3d7a4a" />
        </g>
      ))}
    </svg>
  )
}

/** Labo de greffage — a bubbling flask of new varieties. */
export function FlaskIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path d="M20 6h8v10l9 18a5 5 0 0 1-4.5 7.2h-17A5 5 0 0 1 11 34l9-18z" fill="#eaf7f7" stroke="#2f8f8f" strokeWidth="1.6" />
      <path d="M14.5 30h19" stroke="#2f8f8f" strokeWidth="1.6" />
      <path d="M20 6h8" stroke="#2f8f8f" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="24" cy="35" rx="10" ry="5.5" fill="#57c2c2" opacity="0.75" />
      <circle cx="20" cy="32" r="1.6" fill="#ffc94a" />
      <circle cx="27" cy="34" r="1.2" fill="#ffffff" />
      <circle cx="23" cy="37" r="1" fill="#ffffff" />
    </svg>
  )
}

/** Petite bananeraie familiale — a modest tree beside a tiny homestead. */
export function FamilyPlotIcon({ size = 28, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true">
      <rect x="6" y="26" width="14" height="14" fill="#e3c48c" />
      <path d="M4 26l9-7 9 7z" fill="#a8603f" />
      <rect x="15" y="31" width="4" height="9" fill="#8a5a3b" />
      <rect x="30" y="30" width="5" height="12" rx="1.6" fill="#7a5230" />
      <ellipse cx="33" cy="22" rx="9" ry="7.5" fill="#4c9a5b" />
      <path d="M2 41h44" stroke="#c9a86a" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function TrendUpIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <path d="M3 17l6-6 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h6v6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TrendDownIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <path d="M3 7l6 6 4-4 8 9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 18h6v-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function TrendFlatIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <path d="M3 12h18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function SeasonIcon({ size = 26, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="#ffc94a" />
      <g stroke="#e6a72e" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        <path d="M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
      </g>
    </svg>
  )
}

export function ArrowRightIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true" style={{ verticalAlign: '-3px' }}>
      <path d="M4 12h16M13 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Formats a banana amount consistently: "12.50" + a currency glyph.
 * Use variant="bunch" for aggregate totals (patrimoine, capitalisation, valeur
 * d'une ligne) and the default single banana for liquid cash and per-unit prices,
 * so the two are never visually interchangeable.
 */
export function BananaAmount({
  value,
  showSign = false,
  variant = 'single',
}: {
  value: number
  showSign?: boolean
  variant?: 'single' | 'bunch'
}) {
  const sign = showSign && value >= 0 ? '+' : ''
  return (
    <>
      {sign}
      {value.toFixed(2)} {variant === 'bunch' ? <BananaBunch /> : <Banana />}
    </>
  )
}

export function ArchetypeIcon({ archetype, size }: { archetype: string; size?: number }) {
  switch (archetype) {
    case 'centenaire':
      return <TreeCentenaireIcon size={size} />
    case 'startup':
      return <SproutIcon size={size} />
    case 'industrielle':
      return <PlantationIcon size={size} />
    case 'labo':
      return <FlaskIcon size={size} />
    case 'familiale':
      return <FamilyPlotIcon size={size} />
    default:
      return null
  }
}
