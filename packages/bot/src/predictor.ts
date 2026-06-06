/** Tier 1 momentum predictor — 3-tick EMA crossover, same logic as the frontend mock. */

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

// Per-feed price history (last 10 ticks)
const priceHistory: Record<string, number[]> = {}

function ema(prices: number[], period: number): number {
  if (prices.length === 0) return 0
  const k = 2 / (period + 1)
  let e = prices[0]
  for (let i = 1; i < prices.length; i++) e = prices[i] * k + e * (1 - k)
  return e
}

export async function fetchCurrentPrice(feedId: string): Promise<number> {
  const url = `${HERMES_BASE}?ids[]=${feedId}&parsed=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hermes fetch failed: ${res.status}`)
  const data = await res.json()
  const p = data.parsed?.[0]?.price
  if (!p) throw new Error('No parsed price')
  return Number(BigInt(p.price)) * Math.pow(10, p.expo)
}

export async function predictDirection(feedId: string): Promise<boolean> {
  // Fetch current price and append to history
  const price = await fetchCurrentPrice(feedId)
  if (!priceHistory[feedId]) priceHistory[feedId] = []
  priceHistory[feedId] = [...priceHistory[feedId].slice(-9), price]

  const history = priceHistory[feedId]
  if (history.length < 3) {
    // Not enough data — coin flip weighted 50/50
    return Math.random() > 0.5
  }

  // Momentum: fast(3) vs slow(7) EMA
  const fast = ema(history, 3)
  const slow = ema(history, Math.min(7, history.length))
  const momentumUp = fast > slow

  // Conviction noise: 28% chance to invert (matches Axiom-7's 0.72 conviction)
  return Math.random() > 0.28 ? momentumUp : !momentumUp
}
