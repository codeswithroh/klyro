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

type Asset = 'ETH/USD' | 'BTC/USD' | 'MNT/USD' | 'SOL/USD' | 'BNB/USD' | 'XRP/USD' | 'DOGE/USD' | 'ADA/USD' | 'AVAX/USD'

const FEED_ID_TO_ASSET: Record<string, Asset> = {
  '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace': 'ETH/USD',
  '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43': 'BTC/USD',
  '0x4e65f5d4b78c7ba98fd8b81e83e5e3cef31ce2d5fcfc8d0c3fbba4f37ed7d2e0': 'MNT/USD',
  '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d': 'SOL/USD',
  '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f': 'BNB/USD',
  '0xec5d399846a9209f3fe5881d70aae9268c94339ff9817e8d18ff19fa05eea1c8': 'XRP/USD',
  '0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c': 'DOGE/USD',
  '0x2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d': 'ADA/USD',
  '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7': 'AVAX/USD',
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
async function fetchUsdPrice(asset: Asset): Promise<number> {
  switch (asset) {
    case 'ETH/USD':  return fetchBinancePrice('ETHUSDT')
    case 'BTC/USD':  return fetchBinancePrice('BTCUSDT')
    case 'MNT/USD':  return fetchCoingeckoPrice('mantle')
    case 'SOL/USD':  return fetchBinancePrice('SOLUSDT')
    case 'BNB/USD':  return fetchBinancePrice('BNBUSDT')
    case 'XRP/USD':  return fetchBinancePrice('XRPUSDT')
    case 'DOGE/USD': return fetchBinancePrice('DOGEUSDT')
    case 'ADA/USD':  return fetchBinancePrice('ADAUSDT')
    case 'AVAX/USD': return fetchBinancePrice('AVAXUSDT')
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
