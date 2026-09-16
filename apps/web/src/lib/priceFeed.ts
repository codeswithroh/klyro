/**
 * Live price feed.
 *
 * Pyth Hermes (hermes.pyth.network) started requiring a paid API key on
 * 2026-08-26 — the free public REST endpoint now returns 401 Unauthorized
 * for everyone, keyed or not from the browser. Rather than block the app
 * on a paid subscription, we source live USD prices from free, no-auth
 * exchange APIs and encode them in the same Pyth-style shape (rawPrice
 * scaled by 10^expo, conf, expo) that MockPyth and the rest of the app
 * already expect — MockPyth just stores whatever numbers it's given, it
 * never verified Pyth's signature anyway.
 */

import { PRICE_FEEDS, type AssetPair } from './contracts/addresses'

export interface LivePrice {
  price: number       // human-readable USD
  rawPrice: bigint    // int64, price * 10^-expo
  conf: bigint        // uint64, nominal confidence band
  expo: number
  publishTime: number // unix seconds
}

const EXPO = -8

const FEED_ID_TO_ASSET = Object.fromEntries(
  Object.entries(PRICE_FEEDS).map(([asset, id]) => [id, asset as AssetPair]),
) as Record<string, AssetPair>

async function fetchBinancePrice(symbol: string): Promise<number> {
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`)
  if (!res.ok) throw new Error(`Binance fetch failed: ${res.status}`)
  const data = await res.json()
  const price = Number(data.price)
  if (!price) throw new Error('Binance returned no price')
  return price
}

async function fetchCoingeckoPrice(id: string): Promise<number> {
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
  if (!res.ok) throw new Error(`CoinGecko fetch failed: ${res.status}`)
  const data = await res.json()
  const price = data?.[id]?.usd
  if (!price) throw new Error('CoinGecko returned no price')
  return price
}

// MNT isn't listed on Binance; everything else is (deeper book, higher rate limit).
async function fetchUsdPrice(asset: AssetPair): Promise<number> {
  switch (asset) {
    case 'ETH/USD': return fetchBinancePrice('ETHUSDT')
    case 'BTC/USD': return fetchBinancePrice('BTCUSDT')
    case 'MNT/USD': return fetchCoingeckoPrice('mantle')
    default: throw new Error(`No price source configured for ${asset}`)
  }
}

/** Fetches a live USD price for a Pyth feed ID and encodes it Pyth-style. */
export async function fetchLivePrice(feedId: string): Promise<LivePrice> {
  const asset = FEED_ID_TO_ASSET[feedId]
  if (!asset) throw new Error(`Unknown price feed id: ${feedId}`)

  const price = await fetchUsdPrice(asset)

  const scale = 10 ** -EXPO
  const rawPrice = BigInt(Math.round(price * scale))
  const conf = BigInt(Math.round(price * 0.0001 * scale)) // nominal tight spread

  return {
    price,
    rawPrice,
    conf,
    expo: EXPO,
    publishTime: Math.floor(Date.now() / 1000),
  }
}
