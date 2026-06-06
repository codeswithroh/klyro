'use client'

import { useEffect, useState } from 'react'
import type { AssetPair } from '../contracts/addresses'

interface PriceData {
  price: number
  confidence: number
  publishTime: number
}

// TODO (Phase A): replace with live Pyth Hermes HTTP API polling
// Docs: https://hermes.pyth.network/docs
export function usePythPrice(_pair: AssetPair): { data: PriceData | null; isLoading: boolean } {
  const [data] = useState<PriceData | null>(null)

  return { data, isLoading: false }
}
