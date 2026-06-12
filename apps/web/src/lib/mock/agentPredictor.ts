import type { AssetPair } from './priceSimulator'

export interface AgentPersonality {
  id: string
  name: string
  initials: string
  strategy: string
  // How strongly the agent follows its signal (0–1). Adds noise at lower values.
  conviction: number
  // 'momentum' uses EMA crossover; 'contrarian' bets opposite
  style: 'momentum' | 'contrarian' | 'random'
}

export const AGENTS: AgentPersonality[] = [
  {
    id: 'axiom-7',
    name: 'Axiom-7',
    initials: 'AX',
    // Counter-trend: fades the recent 3-tick EMA signal expecting mean reversion.
    // This creates genuine head-to-head tension with momentum-following humans.
    strategy: 'Counter-momentum fade via 3-tick EMA reversion',
    conviction: 0.75,
    style: 'contrarian',
  },
  {
    id: 'momentum-max',
    name: 'Momentum Max',
    initials: 'MM',
    strategy: 'Aggressive trend-following — doubles down on strong moves',
    conviction: 0.85,
    style: 'momentum',
  },
  {
    id: 'contrarian-cora',
    name: 'Contrarian Cora',
    initials: 'CC',
    strategy: 'Fades momentum — bets on reversals after 3+ tick streaks',
    conviction: 0.65,
    style: 'contrarian',
  },
]

function ema(prices: number[], period: number): number {
  if (prices.length === 0) return 0
  const k = 2 / (period + 1)
  let e = prices[0]
  for (let i = 1; i < prices.length; i++) {
    e = prices[i] * k + e * (1 - k)
  }
  return e
}

// Returns 'up' | 'down' based on the agent's strategy and price history.
export function agentPredict(
  agent: AgentPersonality,
  history: number[],
): 'up' | 'down' {
  if (history.length < 3 || agent.style === 'random') {
    return Math.random() > 0.5 ? 'up' : 'down'
  }

  // Momentum signal: fast EMA vs slow EMA
  const fast = ema(history, 3)
  const slow = ema(history, 7)
  const momentumUp = fast > slow

  let call: boolean
  if (agent.style === 'momentum') {
    call = momentumUp
  } else {
    // contrarian
    call = !momentumUp
  }

  // Add noise inversely proportional to conviction
  const noise = Math.random()
  if (noise > agent.conviction) {
    call = !call
  }

  return call ? 'up' : 'down'
}

export function getAgent(agentId: string): AgentPersonality {
  return AGENTS.find((a) => a.id === agentId) ?? AGENTS[0]
}

// Picks an agent for the round (could be random or fixed for MVP)
export function assignAgent(_asset: AssetPair, _roundId: number): AgentPersonality {
  // For now always use Axiom-7 — Phase D will randomize via Pyth Entropy
  return AGENTS[0]
}
