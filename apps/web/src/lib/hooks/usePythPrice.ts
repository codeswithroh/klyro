'use client'

import { useQuery } from '@tanstack/react-query'
import { PRICE_FEEDS, type AssetPair } from '../contracts/addresses'
import { fetchLivePrice } from '../priceFeed'

interface PythPriceData {
  price: number      // human-readable (adjusted by exponent)
  rawPrice: bigint   // raw int64 from oracle
  expo: number
  confidence: number
  publishTime: number
  vaas: string[]     // unused with MockPyth — no VAA verification on-chain
}

async function fetchPythPrice(feedId: string): Promise<PythPriceData> {
  const p = await fetchLivePrice(feedId)
  return {
    price: p.price,
    rawPrice: p.rawPrice,
    expo: p.expo,
    confidence: Number(p.conf) * Math.pow(10, p.expo),
    publishTime: p.publishTime,
    vaas: [],
  }
}

export function usePythPrice(pair: AssetPair) {
  const feedId = PRICE_FEEDS[pair]

  return useQuery({
    queryKey: ['pyth-price', feedId],
    queryFn: () => fetchPythPrice(feedId),
    refetchInterval: 1_000,   // poll every 1s — matches mock simulation speed; Hermes handles it fine
    staleTime: 800,
    retry: 3,
  })
}

export type { PythPriceData }
