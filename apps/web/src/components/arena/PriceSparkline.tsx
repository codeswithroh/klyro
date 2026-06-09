'use client'

import type { PricePoint } from '@/lib/store/roundStore'

interface PriceSparklineProps {
  history: PricePoint[]
  isUp: boolean
  // Fixed-size mode (small sparklines):
  width?: number
  height?: number
  // Full-screen terminal mode — fills parent div:
  fill?: boolean
  startPrice?: number
  liveMode?: boolean
}

const VB_W = 1200
const VB_H = 400

export function PriceSparkline({
  history,
  isUp,
  width = 360,
  height = 96,
  fill = false,
  startPrice,
  liveMode = false,
}: PriceSparklineProps) {
  const vbW = fill ? VB_W : width
  const vbH = fill ? VB_H : height

  if (history.length < 2) {
    if (fill) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[11px] text-white/25 uppercase tracking-[.14em] animate-pulse">
            Collecting feed…
          </span>
        </div>
      )
    }
    return null
  }

  const prices = history.map((p) => p.price)
  const allPrices = startPrice !== undefined ? [...prices, startPrice] : prices
  const rawMin = Math.min(...allPrices)
  const rawMax = Math.max(...allPrices)
  const spread = rawMax - rawMin || rawMin * 0.001 || 1
  const padY = spread * (fill ? 0.22 : 0.18)
  const min = rawMin - padY
  const max = rawMax + padY
  const range = max - min

  // Margins within the viewBox
  const ML = fill ? 8  : 0
  const MR = fill ? 72 : 4   // leave room for Y-axis labels on right
  const MT = fill ? 20 : 10
  const MB = fill ? 32 : 6
  const cW = vbW - ML - MR
  const cH = vbH - MT - MB

  const toX = (i: number) => ML + (i / Math.max(prices.length - 1, 1)) * cW
  const toY = (p: number) => MT + cH - ((p - min) / range) * cH

  const pts = prices.map((p, i) => ({ x: toX(i), y: toY(p) }))
  const linePath = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)},${(MT + cH).toFixed(1)} L ${pts[0].x.toFixed(1)},${(MT + cH).toFixed(1)} Z`

  const color = isUp ? '#07BE6A' : '#F12E49'
  const gradId = `grad-${isUp ? 'up' : 'dn'}-${fill ? 'fill' : width}`
  const baselineY = startPrice !== undefined ? toY(startPrice) : null
  const last = pts[pts.length - 1]

  // Y-axis tick values (3 levels) for fill mode
  const yTicks = fill
    ? [min + range * 0.2, min + range * 0.5, min + range * 0.8].map((v) => ({
        value: v,
        y: toY(v),
      }))
    : []

  // Format price compactly
  const fmtPrice = (p: number) =>
    p >= 1000 ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : p >= 1    ? p.toFixed(4)
    : p.toFixed(6)

  const svgProps = fill
    ? { width: '100%', height: '100%', viewBox: `0 0 ${vbW} ${vbH}`, preserveAspectRatio: 'none' as const, className: 'absolute inset-0' }
    : { width, height, viewBox: `0 0 ${vbW} ${vbH}`, className: 'overflow-visible' as const }

  return (
    <svg {...svgProps} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fill ? '0.22' : '0.28'} />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        {fill && (
          <linearGradient id={`${gradId}-strong`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="60%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        )}
      </defs>

      {/* horizontal grid lines (fill mode only) */}
      {fill && yTicks.map((t) => (
        <line
          key={t.value}
          x1={ML} y1={t.y.toFixed(1)}
          x2={ML + cW} y2={t.y.toFixed(1)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      ))}

      {/* start-price baseline */}
      {baselineY !== null && (
        <line
          x1={ML} y1={baselineY.toFixed(1)}
          x2={ML + cW} y2={baselineY.toFixed(1)}
          stroke="rgba(255,255,255,0.28)"
          strokeWidth={fill ? '1.5' : '0.8'}
          strokeDasharray={fill ? '6,5' : '5,4'}
        />
      )}

      {/* area fill */}
      <path d={areaPath} fill={fill ? `url(#${gradId}-strong)` : `url(#${gradId})`} />

      {/* price line */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={fill ? '2.5' : '1.8'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Y-axis price labels (fill mode) */}
      {fill && yTicks.map((t) => (
        <text
          key={`lbl-${t.value}`}
          x={(ML + cW + 8).toFixed(1)}
          y={(t.y + 4).toFixed(1)}
          fill="rgba(255,255,255,0.3)"
          fontSize="14"
          fontFamily="JetBrains Mono, monospace"
        >
          {fmtPrice(t.value)}
        </text>
      ))}

      {/* current price label on Y axis (fill mode) */}
      {fill && (
        <text
          x={(ML + cW + 8).toFixed(1)}
          y={(last.y + 4).toFixed(1)}
          fill={color}
          fontSize="15"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="600"
        >
          {fmtPrice(prices[prices.length - 1])}
        </text>
      )}

      {/* start price label (fill mode) */}
      {fill && baselineY !== null && startPrice !== undefined && (
        <text
          x={(ML + 6).toFixed(1)}
          y={(baselineY - 6).toFixed(1)}
          fill="rgba(255,255,255,0.35)"
          fontSize="12"
          fontFamily="JetBrains Mono, monospace"
        >
          OPEN {fmtPrice(startPrice)}
        </text>
      )}

      {/* pulsing dot at current price */}
      {liveMode && (
        <>
          <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r={fill ? '4' : '3'} fill={color} />
          <circle cx={last.x.toFixed(1)} cy={last.y.toFixed(1)} r={fill ? '4' : '3'} fill={color} opacity="0.3">
            <animate attributeName="r" values={fill ? '4;12;4' : '3;9;3'} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </svg>
  )
}
