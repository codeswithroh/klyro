import type { AssetPair } from '../contracts/addresses'

export type { AssetPair }

export const SEED_PRICES: Record<AssetPair, number> = {
  'ETH/USD':  3418.2,
  'BTC/USD':  67450.0,
  'MNT/USD':  0.812,
  'SOL/USD':  97.3,
  'BNB/USD':  711.7,
  'XRP/USD':  1.29,
  'DOGE/USD': 0.08,
  'ADA/USD':  0.195,
  'AVAX/USD': 7.26,
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
    this.history = Object.fromEntries(
      Object.entries(SEED_PRICES).map(([asset, price]) => [asset, [price]]),
    ) as Record<AssetPair, number[]>
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
  // Sub-$1 assets need more decimal places or every move rounds to zero.
  if (asset === 'MNT/USD' || asset === 'DOGE/USD' || asset === 'ADA/USD') {
    return `$${price.toFixed(4)}`
  }
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDelta(start: number, current: number): { text: string; isUp: boolean } {
  const pct = ((current - start) / start) * 100
  const sign = pct >= 0 ? '+' : ''
  return { text: `${sign}${pct.toFixed(3)}%`, isUp: pct >= 0 }
}
