'use client'

import { useQuery } from '@tanstack/react-query'
import { PRICE_FEEDS, type AssetPair } from '../contracts/addresses'

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

interface PythPriceData {
  price: number      // human-readable (adjusted by exponent)
  rawPrice: bigint   // raw int64 from oracle
  expo: number
  confidence: number
  publishTime: number
  vaas: string[]     // price update VAAs needed to push on-chain
}

async function fetchPythPrice(feedId: string): Promise<PythPriceData> {
  const url = `${HERMES_BASE}?ids[]=${feedId}&encoding=hex&parsed=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Pyth Hermes fetch failed: ${res.status}`)
  const data = await res.json()

  const parsed = data.parsed?.[0]
  if (!parsed) throw new Error('No parsed price data')

  const rawPrice = BigInt(parsed.price.price)
  const expo = parsed.price.expo
  const price = Number(rawPrice) * Math.pow(10, expo)
  const confidence = Number(BigInt(parsed.price.conf)) * Math.pow(10, expo)

  return {
    price,
    rawPrice,
    expo,
    confidence,
    publishTime: parsed.price.publish_time,
    vaas: data.binary?.data ?? [],
  }
}

export function usePythPrice(pair: AssetPair) {
  const feedId = PRICE_FEEDS[pair]

  return useQuery({
    queryKey: ['pyth-price', feedId],
    queryFn: () => fetchPythPrice(feedId),
    refetchInterval: 3_000,   // poll every 3s — Pyth updates ~400ms on-chain, 3s is fine for display
    staleTime: 2_000,
    retry: 3,
  })
}

export type { PythPriceData }
