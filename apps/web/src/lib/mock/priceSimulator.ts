export type AssetPair = 'ETH/USD' | 'BTC/USD' | 'MNT/USD'

export const SEED_PRICES: Record<AssetPair, number> = {
  'ETH/USD': 3418.2,
  'BTC/USD': 67450.0,
  'MNT/USD': 0.812,
}

// Max % move per tick (1 second). Simulates realistic micro-volatility.
const TICK_VOLATILITY = 0.0015 // 0.15% per tick max

export class PriceSimulator {
  private prices: Record<AssetPair, number>
  // Last N prices per asset, used by the agent for momentum signal
  private history: Record<AssetPair, number[]>
  private readonly historyLen = 10

  constructor() {
    this.prices = { ...SEED_PRICES }
    this.history = {
      'ETH/USD': [SEED_PRICES['ETH/USD']],
      'BTC/USD': [SEED_PRICES['BTC/USD']],
      'MNT/USD': [SEED_PRICES['MNT/USD']],
    }
  }

  tick(asset: AssetPair): number {
    const prev = this.prices[asset]
    // Gaussian-ish walk: sum of two uniform samples
    const rand = (Math.random() + Math.random()) / 2 - 0.5
    const delta = prev * TICK_VOLATILITY * rand * 2
    const next = Math.max(prev + delta, prev * 0.98) // floor at -2% of current
    this.prices[asset] = next

    this.history[asset] = [...this.history[asset].slice(-(this.historyLen - 1)), next]
    return next
  }

  current(asset: AssetPair): number {
    return this.prices[asset]
  }

  getHistory(asset: AssetPair): number[] {
    return this.history[asset]
  }
}

// Global singleton shared across the app
export const globalPriceSimulator = new PriceSimulator()

export function formatPrice(asset: AssetPair, price: number): string {
  if (asset === 'MNT/USD') return `$${price.toFixed(4)}`
  if (asset === 'BTC/USD') return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDelta(start: number, current: number): { text: string; isUp: boolean } {
  const pct = ((current - start) / start) * 100
  const sign = pct >= 0 ? '+' : ''
  return { text: `${sign}${pct.toFixed(3)}%`, isUp: pct >= 0 }
}
