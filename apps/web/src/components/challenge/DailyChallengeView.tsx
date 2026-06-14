'use client'

/**
 * DailyChallengeView — the daily retention loop.
 *
 * One challenge per UTC day vs Axiom-7. Owns: the intro card, once-per-day
 * gating, streak tracking (localStorage), the completion screen, and the
 * Wordle-style share card. Delegates the actual play to <ChallengeView> in
 * daily mode (additive, non-breaking props).
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChallengeView, type RoundRecord } from './ChallengeView'
import {
  dailyNumber, dailyConfig, loadDailyState, recordDaily, hasPlayedToday,
  msUntilNextDaily, dailyShareText,
  type DailyState, type DailyResult,
} from '@/lib/daily'

type Screen = 'intro' | 'playing' | 'done'

function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const SQUARE = { win: '🟩', lose: '🟥', draw: '🟨' } as const

export function DailyChallengeView() {
  const [mounted, setMounted] = useState(false)
  const [state,   setState]   = useState<DailyState | null>(null)
  const [screen,  setScreen]  = useState<Screen>('intro')
  const [countdown, setCountdown] = useState(0)

  const n   = dailyNumber()
  const cfg = dailyConfig(n)

  // Hydrate from localStorage on the client only (avoids SSR mismatch).
  useEffect(() => {
    const s = loadDailyState()
    setState(s)
    setMounted(true)
    if (hasPlayedToday(s, n)) setScreen('done')
  }, [n])

  // Live countdown to the next daily.
  useEffect(() => {
    if (screen !== 'done') return
    const tick = () => setCountdown(msUntilNextDaily())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [screen])

  function handleComplete({ humanScore, agentScore, records }: {
    humanScore: number; agentScore: number; records: RoundRecord[]
  }) {
    const won = humanScore > agentScore
    const result: Omit<DailyResult, 'playedAt'> = {
      number:     n,
      won,
      humanScore,
      agentScore,
      verdicts:   records.map(r => r.verdict),
    }
    const next = recordDaily(result, loadDailyState())
    setState(next)
    setScreen('done')
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!mounted || !state) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--sig)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  if (screen === 'playing') {
    return (
      <ChallengeView
        dailyMode
        dailyConfig={{ difficulty: cfg.difficulty, duration: cfg.duration }}
        onComplete={handleComplete}
      />
    )
  }

  // ── Done (already played today) ──────────────────────────────────────────────
  if (screen === 'done' && state.lastResult && state.lastResult.number === n) {
    const r = state.lastResult
    const accent = r.won ? '#07BE6A' : r.humanScore === r.agentScore ? '#d97706' : '#F12E49'
    const headline = r.won ? 'You beat Axiom-7' : r.humanScore === r.agentScore ? 'Dead heat' : 'Axiom-7 won'

    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      dailyShareText(r, state.streak, typeof window !== 'undefined' ? window.location.origin : 'https://klyro-jet.vercel.app'),
    )}`

    return (
      <div className="min-h-screen py-14 px-4" style={{ background: 'var(--paper)' }}>
        <div className="max-w-[440px] mx-auto">
          <DailyHeader n={n} />

          <div className="rounded-2xl p-6 mb-4 shadow-sm text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="font-mono text-[10px] uppercase tracking-[.18em] mb-2" style={{ color: 'var(--ink-3)' }}>
              Daily #{n} · complete
            </div>
            <div className="font-display font-black text-[30px] uppercase mb-2" style={{ color: accent }}>
              {headline}
            </div>
            <div className="text-[30px] tracking-[.12em] mb-3">
              {r.verdicts.map((v, i) => <span key={i}>{SQUARE[v]}</span>)}
            </div>
            <div className="font-mono text-[13px]" style={{ color: 'var(--ink-2)' }}>
              You {r.humanScore} — {r.agentScore} Axiom-7
            </div>
          </div>

          {/* streak stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBox value={`${state.streak}🔥`} label="Day streak" color="#d97706" />
            <StatBox value={String(state.bestStreak)} label="Best streak" />
            <StatBox value={`${state.totalWins}/${state.totalPlayed}`} label="Wins" color="#07BE6A" />
          </div>

          {/* next daily countdown */}
          <div className="rounded-xl py-3 mb-4 text-center"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <div className="font-mono text-[10px] uppercase tracking-[.14em] mb-0.5" style={{ color: 'var(--ink-3)' }}>
              Next challenge in
            </div>
            <div className="font-mono font-bold text-[18px] tabular-nums" style={{ color: 'var(--ink)' }}>
              {fmtCountdown(countdown)}
            </div>
          </div>

          <div className="space-y-2.5">
            <a href={shareUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-mono text-[12px] font-bold uppercase tracking-[.07em] text-white transition-opacity hover:opacity-80"
              style={{ background: 'var(--ink)' }}>
              Share streak on X
            </a>
            <Link href="/challenge"
              className="block text-center w-full py-3.5 rounded-xl font-mono text-[12px] font-bold uppercase tracking-[.07em] transition-opacity hover:opacity-80"
              style={{ background: 'var(--sig)', color: '#fff', boxShadow: '0 4px 16px rgba(108,43,242,0.3)' }}>
              Play unlimited Gauntlet →
            </Link>
            <Link href="/"
              className="block text-center w-full py-2 rounded-xl font-mono text-[11px]"
              style={{ color: 'var(--ink-3)' }}>
              ← Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Intro ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: 'var(--paper)' }}>
      <div className="w-full max-w-[440px]">
        <DailyHeader n={n} />

        <div className="rounded-2xl p-6 mb-5 shadow-sm text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
          <div className="text-[40px] mb-2">🗓️</div>
          <h1 className="font-mono font-black text-[26px] tracking-[-0.02em] mb-2" style={{ color: 'var(--ink)' }}>
            Daily Challenge #{n}
          </h1>
          <p className="font-mono text-[12px] leading-relaxed mb-4" style={{ color: 'var(--ink-2)' }}>
            One shot a day against Axiom-7. Same challenge for everyone.
            {' '}<span style={{ color: 'var(--sig)', fontWeight: 600 }}>
              {cfg.difficulty === 'best-of-5' ? 'Best of 5' : 'Best of 3'} · {cfg.duration}s rounds · ETH/USD
            </span>
          </p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <StatBox value={`${state.streak}🔥`} label="Streak" color="#d97706" />
            <StatBox value={String(state.bestStreak)} label="Best" />
            <StatBox value={`${state.totalWins}/${state.totalPlayed}`} label="Record" color="#07BE6A" />
          </div>

          <button onClick={() => setScreen('playing')}
            className="w-full py-4 rounded-xl font-mono font-bold text-[14px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97]"
            style={{ background: 'var(--sig)', boxShadow: '0 4px 20px rgba(108,43,242,0.4)' }}>
            ▶ Start today&apos;s challenge
          </button>
          {state.streak > 0 && (
            <div className="font-mono text-[11px] mt-3" style={{ color: 'var(--ink-3)' }}>
              Keep your {state.streak}-day streak alive 🔥
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href="/challenge" className="font-mono text-[11px] transition-colors hover:opacity-80" style={{ color: 'var(--ink-3)' }}>
            Or play unlimited Gauntlet →
          </Link>
        </div>
      </div>
    </div>
  )
}

function DailyHeader({ n }: { n: number }) {
  return (
    <div className="flex items-center justify-end mb-6">
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{ background: 'var(--sig-wash)', border: '1px solid rgba(108,43,242,0.25)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-[#6C2BF2] animate-pulse" />
        <span className="font-mono text-[10px] tracking-[.16em] uppercase" style={{ color: 'var(--sig)' }}>
          Daily · #{n}
        </span>
      </div>
    </div>
  )
}

function StatBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ background: 'var(--paper)', borderColor: 'var(--line)' }}>
      <div className="font-display font-black text-[20px] leading-none mb-1" style={{ color: color ?? 'var(--ink)' }}>{value}</div>
      <div className="font-mono text-[9px] tracking-[.1em] uppercase" style={{ color: 'var(--ink-3)' }}>{label}</div>
    </div>
  )
}
