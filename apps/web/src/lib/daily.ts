/**
 * Daily Challenge — the retention spine.
 *
 * One shared challenge per UTC day against Axiom-7. The config is derived
 * deterministically from the date, so everyone faces the same difficulty/duration
 * on a given day (Wordle-style). Progress, streaks, and history live in
 * localStorage — no wallet required to build a streak.
 */

export type DailyDifficulty = 'best-of-3' | 'best-of-5'

export interface DailyConfig {
  number:     number          // daily index, e.g. 142
  difficulty: DailyDifficulty
  rounds:     number
  duration:   number          // seconds per round
  asset:      'ETH/USD'
}

export interface DailyResult {
  number:     number
  won:        boolean
  humanScore: number
  agentScore: number
  verdicts:   ('win' | 'lose' | 'draw')[]
  playedAt:   number          // unix ms
}

export interface DailyState {
  lastPlayedNumber: number | null
  streak:           number    // consecutive UTC days played
  bestStreak:       number
  totalWins:        number
  totalPlayed:      number
  lastResult:       DailyResult | null
  history:          DailyResult[]   // most recent first, capped
}

const STORAGE_KEY = 'klyro_daily_v1'
const EPOCH_MS    = Date.UTC(2026, 0, 1) // Daily #1 = 2026-01-01 (UTC)
const DAY_MS      = 86_400_000
const HISTORY_CAP = 30

/** UTC day index since the epoch. Day boundary is 00:00 UTC. */
export function dailyNumber(now: number = nowMs()): number {
  const d = new Date(now)
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.floor((utcMidnight - EPOCH_MS) / DAY_MS) + 1
}

/** Deterministic config for a given daily number — same for everyone that day. */
export function dailyConfig(n: number = dailyNumber()): DailyConfig {
  // Rotate duration for variety; keep it fair and comparable within the day.
  const durations: number[] = [15, 30, 45, 30, 60]
  const duration = durations[n % durations.length]
  // Bo5 on every 5th day for a tougher "gauntlet day", else Bo3.
  const isBo5    = n % 5 === 0
  return {
    number:     n,
    difficulty: isBo5 ? 'best-of-5' : 'best-of-3',
    rounds:     isBo5 ? 5 : 3,
    duration,
    asset:      'ETH/USD',
  }
}

/** Milliseconds until the next UTC midnight (for the "next challenge in" timer). */
export function msUntilNextDaily(now: number = nowMs()): number {
  const d = new Date(now)
  const nextMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
  return nextMidnight - now
}

// localStorage is only available client-side; guard every access.
function nowMs(): number {
  return typeof performance !== 'undefined' && typeof Date !== 'undefined'
    ? Date.now()
    : 0
}

const EMPTY_STATE: DailyState = {
  lastPlayedNumber: null,
  streak:           0,
  bestStreak:       0,
  totalWins:        0,
  totalPlayed:      0,
  lastResult:       null,
  history:          [],
}

export function loadDailyState(): DailyState {
  if (typeof window === 'undefined') return { ...EMPTY_STATE }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...EMPTY_STATE }
    const parsed = JSON.parse(raw) as Partial<DailyState>
    return { ...EMPTY_STATE, ...parsed }
  } catch {
    return { ...EMPTY_STATE }
  }
}

function saveDailyState(state: DailyState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage full / blocked — non-fatal */
  }
}

/** True if today's challenge has already been completed. */
export function hasPlayedToday(state: DailyState, n: number = dailyNumber()): boolean {
  return state.lastPlayedNumber === n
}

/**
 * Record a completed daily. Streak increments only if the previous play was
 * exactly yesterday; a gap resets it to 1. Idempotent for the same day.
 */
export function recordDaily(
  result: Omit<DailyResult, 'playedAt'>,
  prev: DailyState = loadDailyState(),
): DailyState {
  if (prev.lastPlayedNumber === result.number) return prev // already recorded today

  const playedYesterday = prev.lastPlayedNumber === result.number - 1
  const streak     = playedYesterday ? prev.streak + 1 : 1
  const fullResult: DailyResult = { ...result, playedAt: nowMs() }

  const next: DailyState = {
    lastPlayedNumber: result.number,
    streak,
    bestStreak:  Math.max(prev.bestStreak, streak),
    totalWins:   prev.totalWins + (result.won ? 1 : 0),
    totalPlayed: prev.totalPlayed + 1,
    lastResult:  fullResult,
    history:     [fullResult, ...prev.history].slice(0, HISTORY_CAP),
  }
  saveDailyState(next)
  return next
}

const SQUARE = { win: '🟩', lose: '🟥', draw: '🟨' } as const

/** Wordle-style shareable text for a completed daily. */
export function dailyShareText(result: DailyResult, streak: number, baseUrl: string): string {
  const squares = result.verdicts.map(v => SQUARE[v]).join('')
  const outcome = result.won ? 'I beat Axiom-7' : result.humanScore === result.agentScore ? 'I tied Axiom-7' : 'Axiom-7 beat me'
  const streakLine = streak > 1 ? `\n🔥 ${streak}-day streak` : ''
  return `Klyro Daily #${result.number}\n${squares}  ${outcome} ${result.humanScore}–${result.agentScore}${streakLine}\n\nBeat the AI → ${baseUrl}/daily\n#Klyro #Mantle #HumanVsAI`
}
