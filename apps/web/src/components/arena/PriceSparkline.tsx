'use client'

import type { PricePoint } from '@/lib/store/roundStore'

interface PriceSparklineProps {
  history: PricePoint[]
  isUp: boolean
  width?: number
  height?: number
}

export function PriceSparkline({ history, isUp, width = 200, height = 40 }: PriceSparklineProps) {
  if (history.length < 2) return null

  const prices = history.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - ((p - min) / range) * height
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`
  const color = isUp ? 'var(--up)' : 'var(--down)'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
