'use client'

import { useEffect, useRef } from 'react'
import { useRoundStore } from '../store/roundStore'
import { globalPriceSimulator, formatPrice } from '../mock/priceSimulator'

// Keeps price ticking even when no round is open (for the live display).
export function useIdlePriceTick() {
  const phase = useRoundStore((s) => s.phase)
  const asset = useRoundStore((s) => s.asset)
  const setAsset = useRoundStore((s) => s.setAsset)
  const ref = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (phase === 'idle') {
      ref.current = setInterval(() => {
        const price = globalPriceSimulator.tick(asset)
        // Patch just currentPrice + formattedPrice directly
        useRoundStore.setState({
          currentPrice: price,
          formattedPrice: formatPrice(asset, price),
        })
      }, 1500) // slower tick when idle — less distracting
    } else {
      if (ref.current) { clearInterval(ref.current); ref.current = null }
    }
    return () => { if (ref.current) clearInterval(ref.current) }
  }, [phase, asset])

  void setAsset // consume to avoid lint warning
}
