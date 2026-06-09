'use client'

import type { PricePoint, Call } from '@/lib/store/roundStore'

interface ArenaChartProps {
  history: PricePoint[]
  startPrice?: number
  liveMode: boolean
  roundActive: boolean
  humanCall: Call | null
  secondsLeft: number
  totalSeconds: number
}

const VB_W = 1400
const VB_H = 560
const MR   = 90   // right margin for Y-axis labels
const MT   = 16
const MB   = 8
const ML   = 0

// History fills left 60%; future / prediction zone = right 40%
const HIST_FRAC = 0.60

function fmtP(p: number) {
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (p >= 1)    return p.toFixed(4)
  return p.toFixed(6)
}

export function ArenaChart({
  history, startPrice, liveMode, roundActive, humanCall, secondsLeft, totalSeconds,
}: ArenaChartProps) {
  const cW = VB_W - ML - MR
  const cH = VB_H - MT - MB

  const nowX  = ML + cW * HIST_FRAC
  const histW = cW * HIST_FRAC
  const futW  = cW * (1 - HIST_FRAC)

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (history.length < 2) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none" className="absolute inset-0" aria-hidden>
        <defs>
          <pattern id="dots0" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.9" fill="rgba(51,65,85,0.35)" />
          </pattern>
        </defs>
        <rect width={VB_W} height={VB_H} fill="url(#dots0)" />
        <text x={VB_W / 2} y={VB_H / 2} fill="rgba(255,255,255,0.15)"
          fontSize="18" fontFamily="JetBrains Mono, monospace" textAnchor="middle" dominantBaseline="middle">
          Awaiting price feed…
        </text>
      </svg>
    )
  }

  // ── Price range ──────────────────────────────────────────────────────────────
  // Only show last 40 ticks so the chart is visually dynamic
  const visible = history.slice(-40)
  const prices  = visible.map(p => p.price)
  const allP    = startPrice !== undefined ? [...prices, startPrice] : prices
  const rawMin  = Math.min(...allP)
  const rawMax  = Math.max(...allP)
  // Ensure minimum visual spread (0.3% of price) so chart never looks flat
  const rawSpread = rawMax - rawMin
  const minSpread = rawMin * 0.003
  const spread    = Math.max(rawSpread, minSpread)
  const pad    = spread * 0.22
  const min    = rawMin - pad
  const max    = rawMax + pad
  const range  = max - min

  const toX = (i: number) => ML + (i / Math.max(prices.length - 1, 1)) * histW
  const toY = (p: number) => MT + cH - ((p - min) / range) * cH

  const pts      = prices.map((p, i) => ({ x: toX(i), y: toY(p) }))
  const linePath = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${(MT + cH).toFixed(1)} L ${pts[0].x.toFixed(1)},${(MT + cH).toFixed(1)} Z`

  const last     = pts[pts.length - 1]
  const currentY = last.y
  const baselineY = startPrice !== undefined ? toY(startPrice) : null

  const isUp      = prices[prices.length - 1] >= prices[0]
  const lineColor = isUp ? '#10b981' : '#f43f5e'
  const gradId    = isUp ? 'g-em' : 'g-ro'

  // Y-axis ticks (5 levels)
  const yTicks = [0.12, 0.3, 0.5, 0.7, 0.88].map(f => ({
    value: min + range * (1 - f),
    y: MT + cH * f,
  }))

  // Future zone: split at current price
  const splitY = Math.max(MT + 28, Math.min(MT + cH - 28, currentY))

  // UP / DOWN intensity based on humanCall
  const upBg    = humanCall === 'up'   ? 'rgba(16,185,129,0.22)' : humanCall === null ? 'rgba(16,185,129,0.10)' : 'rgba(16,185,129,0.04)'
  const downBg  = humanCall === 'down' ? 'rgba(244,63,94,0.22)'  : humanCall === null ? 'rgba(244,63,94,0.10)'  : 'rgba(244,63,94,0.04)'
  const upBdr   = humanCall === 'up'   ? 'rgba(16,185,129,0.55)' : 'rgba(16,185,129,0.20)'
  const downBdr = humanCall === 'down' ? 'rgba(244,63,94,0.55)'  : 'rgba(244,63,94,0.20)'
  const upTxt   = humanCall === 'up'   ? 'rgba(16,185,129,1.0)'  : 'rgba(16,185,129,0.55)'
  const downTxt = humanCall === 'down' ? 'rgba(244,63,94,1.0)'   : 'rgba(244,63,94,0.55)'

  // Number of horizontal price-level grid cells in future zone
  const CELL_ROWS = 8
  const cellH = (MT + cH - MT) / CELL_ROWS

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none" className="absolute inset-0" aria-hidden>
      <defs>
        <pattern id="dots1" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="0.5" cy="0.5" r="0.9" fill="rgba(51,65,85,0.35)" />
        </pattern>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={lineColor} stopOpacity="0.30" />
          <stop offset="55%"  stopColor={lineColor} stopOpacity="0.08" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.01" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Background dot grid */}
      <rect width={VB_W} height={VB_H} fill="url(#dots1)" />

      {/* ── Future zone ─────────────────────────────────────────────────── */}
      {roundActive && (
        <>
          {/* UP zone background */}
          <rect x={nowX} y={MT} width={futW} height={splitY - MT} fill={upBg} />
          {/* DOWN zone background */}
          <rect x={nowX} y={splitY} width={futW} height={MT + cH - splitY} fill={downBg} />

          {/* Horizontal cell grid lines inside future zone */}
          {Array.from({ length: CELL_ROWS + 1 }).map((_, i) => {
            const gy = MT + i * cellH
            return (
              <line key={i} x1={nowX} y1={gy.toFixed(1)} x2={ML + cW} y2={gy.toFixed(1)}
                stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            )
          })}

          {/* Zone border line at split */}
          <line x1={nowX} y1={splitY.toFixed(1)} x2={ML + cW} y2={splitY.toFixed(1)}
            stroke={lineColor} strokeWidth="1.5" strokeDasharray="4,3" opacity="0.6" />

          {/* UP zone top border */}
          <line x1={nowX} y1={MT} x2={ML + cW} y2={MT}
            stroke={upBdr} strokeWidth="1.5" />
          {/* DOWN zone bottom border */}
          <line x1={nowX} y1={MT + cH} x2={ML + cW} y2={MT + cH}
            stroke={downBdr} strokeWidth="1.5" />
          {/* Left edge */}
          <line x1={nowX} y1={MT} x2={nowX} y2={MT + cH}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          {/* Right edge */}
          <line x1={ML + cW} y1={MT} x2={ML + cW} y2={MT + cH}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

          {/* UP zone label */}
          {splitY - MT > 50 && (
            <>
              <text x={(nowX + futW * 0.5).toFixed(1)} y={(splitY * 0.5 + MT * 0.5 - 12).toFixed(1)}
                fill={upTxt} fontSize="28" fontFamily="JetBrains Mono, monospace"
                textAnchor="middle" fontWeight="700" letterSpacing="6">▲ HIGHER</text>
              {humanCall === 'up' && (
                <text x={(nowX + futW * 0.5).toFixed(1)} y={(splitY * 0.5 + MT * 0.5 + 18).toFixed(1)}
                  fill="rgba(16,185,129,0.8)" fontSize="16" fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle" fontWeight="500">Your call ✓</text>
              )}
            </>
          )}
          {/* DOWN zone label */}
          {MT + cH - splitY > 50 && (
            <>
              <text x={(nowX + futW * 0.5).toFixed(1)} y={((splitY + MT + cH) * 0.5 - 8).toFixed(1)}
                fill={downTxt} fontSize="28" fontFamily="JetBrains Mono, monospace"
                textAnchor="middle" fontWeight="700" letterSpacing="6">▼ LOWER</text>
              {humanCall === 'down' && (
                <text x={(nowX + futW * 0.5).toFixed(1)} y={((splitY + MT + cH) * 0.5 + 22).toFixed(1)}
                  fill="rgba(244,63,94,0.8)" fontSize="16" fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle" fontWeight="500">Your call ✓</text>
              )}
            </>
          )}

          {/* Progress bar across top of future zone */}
          <rect x={nowX} y={MT} width={futW} height="3" fill="rgba(255,255,255,0.05)" />
          <rect x={nowX} y={MT}
            width={(futW * Math.max(0, secondsLeft) / Math.max(totalSeconds, 1)).toFixed(1)}
            height="3" fill="#6C2BF2" opacity="0.9" />
        </>
      )}

      {/* ── Chart history area ───────────────────────────────────────────── */}
      {/* Subtle horizontal grid lines */}
      {yTicks.map((t, i) => (
        <line key={i} x1={ML} y1={t.y.toFixed(1)} x2={nowX} y2={t.y.toFixed(1)}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}

      {/* Start price baseline */}
      {baselineY !== null && startPrice !== undefined && (
        <>
          <line x1={ML} y1={baselineY.toFixed(1)} x2={nowX} y2={baselineY.toFixed(1)}
            stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeDasharray="7,5" />
          <text x={(ML + 6).toFixed(1)} y={(baselineY - 8).toFixed(1)}
            fill="rgba(255,255,255,0.35)" fontSize="13" fontFamily="JetBrains Mono, monospace">
            OPEN {fmtP(startPrice)}
          </text>
        </>
      )}

      {/* "NOW" vertical divider */}
      <line x1={nowX} y1={MT} x2={nowX} y2={MT + cH}
        stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="5,4" />
      <text x={(nowX - 6).toFixed(1)} y={(MT + 14).toFixed(1)}
        fill="rgba(255,255,255,0.25)" fontSize="13" fontFamily="JetBrains Mono, monospace" textAnchor="end">
        NOW
      </text>

      {/* Current price horizontal guide into future */}
      {roundActive && (
        <line x1={nowX} y1={currentY.toFixed(1)} x2={ML + cW} y2={currentY.toFixed(1)}
          stroke={lineColor} strokeWidth="1" strokeDasharray="3,5" opacity="0.5" />
      )}

      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradId})`} />

      {/* Price line with glow */}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />

      {/* ── Y-axis ──────────────────────────────────────────────────────── */}
      {yTicks.map((t, i) => (
        <text key={i} x={(ML + cW + 7).toFixed(1)} y={(t.y + 4).toFixed(1)}
          fill="rgba(255,255,255,0.22)" fontSize="13" fontFamily="JetBrains Mono, monospace">
          {fmtP(t.value)}
        </text>
      ))}

      {/* Current price label */}
      <rect x={ML + cW + 3} y={(currentY - 11).toFixed(1)} width={MR - 6} height="17"
        fill={lineColor} opacity="0.18" rx="2" />
      <text x={(ML + cW + 7).toFixed(1)} y={(currentY + 4).toFixed(1)}
        fill={lineColor} fontSize="14" fontFamily="JetBrains Mono, monospace" fontWeight="700">
        {fmtP(prices[prices.length - 1])}
      </text>

      {/* Pulsing dot at live price */}
      {liveMode && (
        <>
          <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="5"
            fill={lineColor} style={{ filter: `drop-shadow(0 0 8px ${lineColor})` }} />
          <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r="5" fill={lineColor} opacity="0.25">
            <animate attributeName="r" values="5;15;5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </svg>
  )
}
