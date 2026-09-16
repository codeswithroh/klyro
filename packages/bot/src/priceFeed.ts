/**
 * Live price feed.
 *
 * Pyth Hermes (hermes.pyth.network) started requiring a paid API key on
 * 2026-08-26 — the free public REST endpoint now returns 401 Unauthorized.
 * We source live USD prices from free, no-auth exchange APIs instead and
 * encode them in the same Pyth-style shape (rawPrice scaled by 10^expo,
 * conf, expo) that MockPyth and the rest of the stack already expect —
 * MockPyth just stores whatever numbers it's given, it never verified
 * Pyth's signature anyway.
 */

export interface LivePrice {
  price: number       // human-readable USD
  rawPrice: bigint    // int64, price * 10^-expo
  conf: bigint        // uint64, nominal confidence band
  expo: number
  publishTime: number // unix seconds
}

const EXPO = -8

const FEED_ID_TO_ASSET: Record<string, 'ETH/USD' | 'BTC/USD' | 'MNT/USD'> = {
  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace': 'ETH/USD',
  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43': 'BTC/USD',
  '0x4e65f5d4b78c7ba98fd8b81e83e5e3cef31ce2d5fcfc8d0c3fbba4f37ed7d2e0': 'MNT/USD',
}

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
async function fetchUsdPrice(asset: 'ETH/USD' | 'BTC/USD' | 'MNT/USD'): Promise<number> {
  switch (asset) {
    case 'ETH/USD': return fetchBinancePrice('ETHUSDT')
    case 'BTC/USD': return fetchBinancePrice('BTCUSDT')
    case 'MNT/USD': return fetchCoingeckoPrice('mantle')
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
