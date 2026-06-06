'use client'

import { useEffect, useRef } from 'react'
import { useRoundStore } from '../store/roundStore'

// Drives the price simulator tick every second when a round is open.
export function useRoundTimer() {
  const phase = useRoundStore((s) => s.phase)
  const tick = useRoundStore((s) => s.tick)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (phase === 'open') {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [phase, tick])
}
