/**
 * Axiom-7 Predictor — independent multi-signal strategy
 *
 * Problem with the old approach: sampling price once per round and following
 * momentum means the bot mirrors whatever trend the user sees on the chart.
 *
 * New approach:
 *  1. A background price daemon samples every 10s, building a rich history.
 *  2. The prediction uses THREE independent signals, then combines them:
 *
 *     Signal A — Mean reversion (contrarian)
 *       Strong recent move → bet AGAINST continuation.
 *       Humans chase momentum, Axiom-7 fades it.
 *
 *     Signal B — Volatility regime
 *       High vol (big swings) → lean DOWN (crypto fear bias).
 *       Low vol (quiet market) → lean UP (drift bias).
 *
 *     Signal C — Short-term oscillator (RSI-lite)
 *       Last 6 ticks: if recent up-ticks dominate → DOWN (overbought).
 *       If recent down-ticks dominate → UP (oversold).
 *
 *  3. Signals are combined with weights. If they disagree, the bot expresses
 *     uncertainty by adding noise, producing a genuinely independent call
 *     that diverges from user calls even when both are "rational".
 */

const HERMES_BASE = 'https://hermes.pyth.network/v2/updates/price/latest'

// Per-feed price history — continuously updated by the daemon
const priceHistory: Record<string, number[]> = {}
const MAX_HISTORY = 30   // keep last 30 ticks (~5 min at 10s intervals)
const DAEMON_INTERVAL_MS = 10_000

// Track active daemons so we don't double-start
const daemonActive: Record<string, boolean> = {}

export async function fetchCurrentPrice(feedId: string): Promise<number> {
  const url = `${HERMES_BASE}?ids[]=${feedId}&parsed=true`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Hermes fetch failed: ${res.status}`)
  const data = await res.json()
  const p = data.parsed?.[0]?.price
  if (!p) throw new Error('No parsed price')
  return Number(BigInt(p.price)) * Math.pow(10, p.expo)
}

// Background daemon: poll price every 10s for a feed
function startPriceDaemon(feedId: string) {
  if (daemonActive[feedId]) return
  daemonActive[feedId] = true

  async function tick() {
    try {
      const price = await fetchCurrentPrice(feedId)
      if (!priceHistory[feedId]) priceHistory[feedId] = []
      priceHistory[feedId] = [...priceHistory[feedId].slice(-(MAX_HISTORY - 1)), price]
    } catch {
      // ignore individual fetch failures
    }
    setTimeout(tick, DAEMON_INTERVAL_MS)
  }
  tick()
}

// ── Signals ─────────────────────────────────────────────────────────────────

// Signal A: Mean reversion
// Measures the % move over the last N ticks. Strong moves → bet against them.
// Returns a float: positive = lean UP, negative = lean DOWN, 0 = neutral.
function signalMeanReversion(prices: number[]): number {
  if (prices.length < 4) return 0
  const recent  = prices.slice(-4)
  const oldest  = recent[0]
  const newest  = recent[recent.length - 1]
  const pct     = (newest - oldest) / oldest   // raw % change (e.g. 0.002 = +0.2%)
  const THRESHOLD = 0.0003   // 0.03% — below this we call it noise

  if (Math.abs(pct) < THRESHOLD) return 0      // sideways → no signal
  // Fade the move: big up → lean down (negative), big down → lean up (positive)
  const strength = Math.min(Math.abs(pct) / 0.002, 1)  // saturates at 0.2%
  return -Math.sign(pct) * strength
}

// Signal B: Volatility regime
// High volatility → DOWN bias (crypto fear). Low volatility → slight UP drift.
function signalVolatility(prices: number[]): number {
  if (prices.length < 6) return 0
  const window = prices.slice(-6)
  const mean   = window.reduce((a, b) => a + b, 0) / window.length
  const std    = Math.sqrt(window.reduce((s, p) => s + (p - mean) ** 2, 0) / window.length)
  const relStd = std / mean   // coefficient of variation

  const HIGH_VOL = 0.0012   // 0.12% std
  const LOW_VOL  = 0.0003   // 0.03% std

  if (relStd > HIGH_VOL) return -0.4   // high vol → lean DOWN
  if (relStd < LOW_VOL)  return +0.25  // quiet market → slight UP drift
  return 0
}

// Signal C: Short-term RSI-lite (overbought / oversold)
// Counts up vs down ticks in the last 6 candles.
function signalOscillator(prices: number[]): number {
  if (prices.length < 5) return 0
  const window = prices.slice(-6)
  let ups = 0, downs = 0
  for (let i = 1; i < window.length; i++) {
    if (window[i] > window[i - 1]) ups++
    else if (window[i] < window[i - 1]) downs++
  }
  const total = ups + downs
  if (total === 0) return 0
  const ratio = ups / total   // 0 = all down, 1 = all up
  // Overbought (ratio > 0.7) → lean DOWN; oversold (ratio < 0.3) → lean UP
  if (ratio > 0.7)  return -0.6
  if (ratio > 0.55) return -0.2
  if (ratio < 0.3)  return +0.6
  if (ratio < 0.45) return +0.2
  return 0
}

// ── Decision ────────────────────────────────────────────────────────────────

export async function predictDirection(feedId: string): Promise<boolean> {
  // Ensure daemon is running for this feed so history accumulates
  startPriceDaemon(feedId)

  // Fetch one fresh sample and append it
  try {
    const price = await fetchCurrentPrice(feedId)
    if (!priceHistory[feedId]) priceHistory[feedId] = []
    priceHistory[feedId] = [...priceHistory[feedId].slice(-(MAX_HISTORY - 1)), price]
  } catch {
    // If fetch fails, work with existing history
  }

  const history = priceHistory[feedId] ?? []

  if (history.length < 3) {
    // No history yet — use a slight DOWN lean (crypto tends to pull back after opens)
    return Math.random() > 0.55
  }

  // Compute the three signals
  const scoreA = signalMeanReversion(history)   // weight 0.45
  const scoreB = signalVolatility(history)      // weight 0.25
  const scoreC = signalOscillator(history)      // weight 0.30

  const combined = scoreA * 0.45 + scoreB * 0.25 + scoreC * 0.30

  // Add structured noise: the bot is confident (low noise) on strong signals,
  // uncertain (high noise) when signals conflict.
  const signalConflict = Math.abs(scoreA) > 0.3 && Math.abs(scoreC) > 0.3
    && Math.sign(scoreA) !== Math.sign(scoreC)
  const noiseScale = signalConflict ? 0.5 : 0.25
  const noise = (Math.random() * 2 - 1) * noiseScale

  const final = combined + noise

  // Positive final → UP, negative → DOWN
  // Pure ties are broken randomly
  if (Math.abs(final) < 0.05) return Math.random() > 0.5
  return final > 0
}
