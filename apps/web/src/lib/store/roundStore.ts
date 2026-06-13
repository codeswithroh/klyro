import { create } from 'zustand'
import {
  globalPriceSimulator,
  type AssetPair,
  formatPrice,
  formatDelta,
} from '../mock/priceSimulator'
import { agentPredict, AGENTS, assignAgent, type AgentPersonality } from '../mock/agentPredictor'

export type RoundPhase = 'idle' | 'open' | 'resolved'
export type Call = 'up' | 'down'

export interface RoundResult {
  roundId: number
  asset: AssetPair
  startPrice: number
  closePrice: number
  humanCall: Call
  agentCall: Call
  outcome: Call // which direction price actually moved
  humanWon: boolean
  agentWon: boolean
  deltaText: string
  points: number
  newStreak: number
}

export interface LeaderboardEntry {
  rank: number
  type: 'human' | 'agent'
  initials: string
  name: string
  agentId?: string
  points: number
  wins: number
  losses: number
  streak: number
}

export interface PricePoint {
  t: number   // unix ms
  price: number
}

interface RoundState {
  // Meta
  roundId: number
  phase: RoundPhase

  // Asset
  asset: AssetPair
  currentPrice: number
  formattedPrice: string
  priceHistory: PricePoint[]  // for sparkline

  // Round specifics
  startPrice: number
  closePrice: number | null
  secondsLeft: number
  totalSeconds: number

  // Delta since round opened
  deltaText: string
  deltaIsUp: boolean

  // Calls
  humanCall: Call | null
  agentCall: Call | null
  agentThinking: boolean  // true while agent is "deciding"

  // Result
  lastResult: RoundResult | null

  // Leaderboard (mock)
  leaderboard: LeaderboardEntry[]
  humanPoints: number
  humanWins: number
  humanLosses: number
  humanStreak: number

  // Active agent
  agent: AgentPersonality | null

  // Actions
  startRound: (asset: AssetPair, durationSeconds?: number) => void
  makeCall: (call: Call, feedId?: string) => void  // feedId → calls /api/bot-signal for real prediction
  tick: () => void   // called by a setInterval every second
  resetToIdle: () => void
  setAsset: (asset: AssetPair) => void
}

const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, type: 'agent',  initials: 'AX', name: 'Axiom-7',        agentId: 'axiom-7',        points: 2280, wins: 142, losses: 54,  streak: 5 },
  { rank: 2, type: 'human',  initials: 'SK', name: 'satoshi_k',                                  points: 1990, wins: 98,  losses: 45,  streak: 3 },
  { rank: 3, type: 'agent',  initials: 'MM', name: 'Momentum Max',   agentId: 'momentum-max',   points: 1870, wins: 115, losses: 58,  streak: 0 },
  { rank: 4, type: 'human',  initials: 'AL', name: 'alpha_lena',                                 points: 1740, wins: 87,  losses: 40,  streak: 2 },
  { rank: 5, type: 'agent',  initials: 'CC', name: 'Contrarian Cora',agentId: 'contrarian-cora', points: 1630, wins: 102, losses: 61,  streak: 1 },
]

// The "you" slot is injected dynamically below
const YOU_ENTRY: LeaderboardEntry = {
  rank: 6, type: 'human', initials: 'YO', name: 'You', points: 0, wins: 0, losses: 0, streak: 0,
}

function calcPoints(streak: number): number {
  const base = 100
  const multiplier = streak >= 3 ? streak : 1
  return base * multiplier
}

function rebuildLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.points - a.points)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

export const useRoundStore = create<RoundState>((set, get) => ({
  roundId: 1000,
  phase: 'idle',
  asset: 'ETH/USD',
  currentPrice: globalPriceSimulator.current('ETH/USD'),
  formattedPrice: formatPrice('ETH/USD', globalPriceSimulator.current('ETH/USD')),
  priceHistory: [{ t: Date.now(), price: globalPriceSimulator.current('ETH/USD') }],
  startPrice: 0,
  closePrice: null,
  secondsLeft: 60,
  totalSeconds: 60,
  deltaText: '+0.000%',
  deltaIsUp: true,
  humanCall: null,
  agentCall: null,
  agentThinking: false,
  lastResult: null,
  leaderboard: rebuildLeaderboard([...INITIAL_LEADERBOARD, YOU_ENTRY]),
  humanPoints: 0,
  humanWins: 0,
  humanLosses: 0,
  humanStreak: 0,
  agent: null,

  // ── Actions ────────────────────────────────────────────────────────────

  setAsset: (asset) => {
    set({
      asset,
      currentPrice: globalPriceSimulator.current(asset),
      formattedPrice: formatPrice(asset, globalPriceSimulator.current(asset)),
      priceHistory: [{ t: Date.now(), price: globalPriceSimulator.current(asset) }],
    })
  },

  startRound: (asset, durationSeconds = 60) => {
    const price = globalPriceSimulator.current(asset)
    const agent = assignAgent(asset, get().roundId)

    set({
      phase: 'open',
      asset,
      startPrice: price,
      closePrice: null,
      currentPrice: price,
      formattedPrice: formatPrice(asset, price),
      priceHistory: [{ t: Date.now(), price }],
      secondsLeft: durationSeconds,
      totalSeconds: durationSeconds,
      deltaText: '+0.000%',
      deltaIsUp: true,
      humanCall: null,
      agentCall: null,
      agentThinking: false,
      agent,
      lastResult: null,
    })
  },

  makeCall: (call, feedId?) => {
    const { phase, agent, asset } = get()
    if (phase !== 'open') return

    set({ humanCall: call, agentThinking: true })

    // Think delay: 2–5s for a realistic feel
    const thinkMs = 2000 + Math.random() * 3000

    if (feedId) {
      // Gauntlet mode: fetch real market-based direction from API
      // API responds fast; we apply the result after the think delay.
      let apiDirection: 'up' | 'down' | null = null
      fetch('/api/bot-signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId }),
      })
        .then(r => r.json())
        .then(({ direction }) => { apiDirection = direction ?? null })
        .catch(() => {})

      setTimeout(() => {
        if (!get().agentThinking) return  // already resolved externally
        const history = globalPriceSimulator.getHistory(asset)
        const agentCall: Call = apiDirection ?? agentPredict(agent!, history)
        set({ agentCall, agentThinking: false })
      }, thinkMs)
    } else {
      // Non-gauntlet mock mode: use local algorithm
      setTimeout(() => {
        if (!get().agentThinking) return
        const history = globalPriceSimulator.getHistory(asset)
        const agentCall = agentPredict(agent!, history)
        set({ agentCall, agentThinking: false })
      }, thinkMs)
    }
  },

  tick: () => {
    const { phase, asset, secondsLeft, startPrice, roundId } = get()
    if (phase !== 'open') return

    // Advance price
    const newPrice = globalPriceSimulator.tick(asset)
    const { text: deltaText, isUp: deltaIsUp } = formatDelta(startPrice, newPrice)

    if (secondsLeft <= 1) {
      // ── Resolve round ──────────────────────────────────────────────────
      const { humanCall, agentCall, humanPoints, humanWins, humanLosses, humanStreak, leaderboard } = get()

      const outcome: Call = newPrice >= startPrice ? 'up' : 'down'

      // If the agent hasn't made a call yet (race condition on short rounds or
      // very late human calls), force a real algorithmic prediction now rather
      // than using the broken default `opposite-of-outcome` which causes draws
      // whenever the human is also wrong.
      const finalAgentCall: Call = agentCall !== null
        ? agentCall
        : agentPredict(get().agent ?? AGENTS[0], globalPriceSimulator.getHistory(asset))

      const humanWon = humanCall !== null && humanCall === outcome
      const agentWon = finalAgentCall === outcome

      let newStreak = humanWon ? humanStreak + 1 : 0
      let earned = 0
      let newWins = humanWins
      let newLosses = humanLosses
      let newPoints = humanPoints

      if (humanCall !== null) {
        if (humanWon) {
          earned = calcPoints(newStreak)
          newWins++
          newPoints += earned
        } else {
          newLosses++
        }
      }

      const result: RoundResult = {
        roundId,
        asset,
        startPrice,
        closePrice: newPrice,
        humanCall: humanCall ?? outcome, // default to outcome if no call (no points)
        agentCall: finalAgentCall,        // always a real prediction, never broken default
        outcome,
        humanWon: humanCall !== null && humanWon,
        agentWon: agentWon,
        deltaText,
        points: earned,
        newStreak,
      }

      // Update the "You" entry in the leaderboard
      const updated = leaderboard.map((e) =>
        e.name === 'You'
          ? { ...e, points: newPoints, wins: newWins, losses: newLosses, streak: newStreak }
          : e
      )

      set({
        phase: 'resolved',
        closePrice: newPrice,
        currentPrice: newPrice,
        formattedPrice: formatPrice(asset, newPrice),
        deltaText,
        deltaIsUp: newPrice >= startPrice,
        secondsLeft: 0,
        lastResult: result,
        roundId: roundId + 1,
        humanPoints: newPoints,
        humanWins: newWins,
        humanLosses: newLosses,
        humanStreak: newStreak,
        leaderboard: rebuildLeaderboard(updated),
      })
    } else {
      set({
        currentPrice: newPrice,
        formattedPrice: formatPrice(asset, newPrice),
        priceHistory: [
          ...get().priceHistory.slice(-59),
          { t: Date.now(), price: newPrice },
        ],
        deltaText,
        deltaIsUp,
        secondsLeft: secondsLeft - 1,
      })
    }
  },

  resetToIdle: () => {
    set({ phase: 'idle', lastResult: null, humanCall: null, agentCall: null, agentThinking: false })
  },
}))
