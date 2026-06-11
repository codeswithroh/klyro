'use client'

/**
 * ChallengeView — Multi-round "Gauntlet" mode.
 *
 * Flow:
 *   1. pick        — difficulty (Bo3/Bo5) + duration (15/30/45/60s)
 *   2. playing     — renders full <ArenaView /> with a challenge HUD overlay
 *   3. between     — between-round card (score + progress)
 *   4. final       — final report with share / rematch
 *
 * The 'playing' phase renders the identical ArenaView interface as Arena mode.
 * A small fixed HUD overlay shows Round X/Y and series score.
 * ChallengeView only manages the outer series state; ArenaView owns all
 * in-round UI (chart, top strip, neon ring, betting panel).
 */

import { useState, useEffect } from 'react'
import { useRoundStore, type Call } from '@/lib/store/roundStore'
import { classifyBattle, calcPoints, getDurationMultiplier } from '@/components/arena/ResultModal'
import { ArenaView } from '@/components/arena/ArenaView'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

type Difficulty   = 'best-of-3' | 'best-of-5'
type ChallengePhase = 'pick' | 'playing' | 'between' | 'final'

interface RoundRecord {
  roundNum:  number
  humanCall: Call
  agentCall: Call
  outcome:   Call
  verdict:   'win' | 'lose' | 'draw'
  delta:     string
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; rounds: number; desc: string; icon: string; color: string }> = {
  'best-of-3': {
    label: 'Best of 3',
    rounds: 3,
    desc: '3 rapid-fire rounds. First to 2 wins takes the match.',
    icon: '⚔️',
    color: '#10b981',
  },
  'best-of-5': {
    label: 'Best of 5',
    rounds: 5,
    desc: '5 rounds. Outlast the algorithm across a full gauntlet.',
    icon: '🏆',
    color: '#6C2BF2',
  },
}

// ── Between-round card ───────────────────────────────────────────────────────

function BetweenRoundCard({
  record, humanScore, agentScore, totalRounds, roundNum, onNext,
}: {
  record: RoundRecord; humanScore: number; agentScore: number
  totalRounds: number; roundNum: number; onNext: () => void
}) {
  const accent   = record.verdict === 'win' ? '#10b981'
    : record.verdict === 'lose' ? '#f43f5e' : '#fbbf24'
  const isLast   = roundNum >= totalRounds
  const humanWinning = humanScore > agentScore
  const tied     = humanScore === agentScore

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,4,10,0.97)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-[340px] rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}44`,
          boxShadow: `0 0 60px ${accent}22` }}>

        {/* Round result header */}
        <div className="px-5 py-4 text-center border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="font-mono text-[10px] text-white/30 uppercase tracking-[.14em] mb-1">
            Round {record.roundNum}
          </div>
          <div className="font-display font-black text-[32px] uppercase" style={{ color: accent }}>
            {record.verdict === 'win' ? 'You Won!' : record.verdict === 'lose' ? 'AI Won' : 'Draw'}
          </div>
          <div className="font-mono text-[12px] text-white/40 mt-1">
            ETH {record.outcome === 'up' ? '▲' : '▼'} {record.delta}
            {' · '}You: {record.humanCall === 'up' ? '▲' : '▼'}
            {' vs '}AI: {record.agentCall === 'up' ? '▲' : '▼'}
          </div>
        </div>

        {/* Score tracker */}
        <div className="px-5 py-5">
          <div className="text-center mb-2">
            <div className="font-mono text-[10px] text-white/30 uppercase tracking-[.1em] mb-3">Series Score</div>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <div className="font-display font-black text-[48px] text-[#10b981] leading-none">{humanScore}</div>
                <div className="font-mono text-[10px] text-white/30 mt-1">You</div>
              </div>
              <div className="font-mono text-[22px] text-white/20 font-bold">-</div>
              <div className="text-center">
                <div className="font-display font-black text-[48px] text-[#f43f5e] leading-none">{agentScore}</div>
                <div className="font-mono text-[10px] text-white/30 mt-1">Axiom-7</div>
              </div>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 my-4">
            {Array.from({ length: totalRounds }).map((_, i) => {
              const filled = i < record.roundNum
              return (
                <div key={i} className="w-2.5 h-2.5 rounded-full transition-all"
                  style={{ background: filled ? accent : 'rgba(255,255,255,0.1)' }} />
              )
            })}
          </div>

          {!isLast && (
            <div className="font-mono text-[11px] text-center text-white/30 mb-4">
              {humanWinning ? '🔥 You\'re ahead — keep it up!'
                : tied ? '⚖️ Tied — next round decides momentum'
                : '📉 AI is leading — time to fight back'}
            </div>
          )}

          <button onClick={onNext}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-[13px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97]"
            style={{ background: isLast
                ? 'linear-gradient(135deg,#6C2BF2,#7c3af5)'
                : 'linear-gradient(135deg,#059669,#10b981)',
              boxShadow: `0 0 24px ${isLast ? 'rgba(108,43,242,0.5)' : 'rgba(16,185,129,0.4)'}` }}>
            {isLast ? 'View Final Report →' : `Round ${record.roundNum + 1} →`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Metric card (Contra-style: label + impact badge + big value) ─────────────

function MetricCard({ label, impact, value, sub, color = 'white', icon }: {
  label: string; impact: 'HIGH' | 'MEDIUM'
  value: string; sub?: string; color?: string; icon?: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col justify-between min-h-[90px]"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-[11px] text-white/45 leading-tight">{label}</span>
        <span className="font-mono text-[8px] uppercase tracking-[.1em] px-1.5 py-0.5 rounded-full shrink-0 ml-1"
          style={impact === 'HIGH'
            ? { background: 'rgba(108,43,242,0.2)', color: '#9A6BFF' }
            : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}>
          {impact === 'HIGH' ? 'HIGH' : 'MED'}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display font-black leading-none" style={{ fontSize: 22, color }}>
            {icon && <span className="mr-1 text-[15px]">{icon}</span>}{value}
          </div>
          {sub && <div className="font-mono text-[10px] text-white/30 mt-1">{sub}</div>}
        </div>
        {/* Chevron */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ opacity: 0.18 }}>
          <path d="M5 2.5l4 4.5-4 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

// ── Final challenge report ────────────────────────────────────────────────────

function FinalReport({
  records, humanScore, agentScore, totalRounds, difficulty, roundDuration, onRematch, onHome,
}: {
  records: RoundRecord[]; humanScore: number; agentScore: number
  totalRounds: number; difficulty: Difficulty; roundDuration: number
  onRematch: () => void; onHome: () => void
}) {
  const humanWon = humanScore > agentScore
  const tied     = humanScore === agentScore

  const totalPts = records.reduce((sum, r) => sum + calcPoints(r.verdict, roundDuration), 0)

  const upCalls   = records.filter(r => r.humanCall === 'up').length
  const downCalls = records.length - upCalls
  const analysis  = records.length > 0
    ? classifyBattle(
        records[records.length - 1].humanCall,
        records[records.length - 1].agentCall,
        records[records.length - 1].outcome,
        records[records.length - 1].verdict,
      )
    : { strategyType: 'Unknown', strategyDesc: '', badge: 'Challenger', badgeIcon: '⚡' }

  const matchBadge = humanWon && humanScore === totalRounds ? { icon: '👑', label: 'Perfect Run' }
    : humanWon ? { icon: '🗡️', label: 'AI Slayer' }
    : tied ? { icon: '🤝', label: 'Dead Heat' }
    : agentScore === totalRounds ? { icon: '🤖', label: 'Dominated' }
    : { icon: '↑', label: 'Next Time' }

  const accent = humanWon ? '#10b981' : tied ? '#fbbf24' : '#f43f5e'

  // Ring progress = win rate (how many rounds human won)
  const RING_R     = 42
  const RING_CIRC  = 2 * Math.PI * RING_R
  const ringFill   = humanScore / totalRounds
  const winRatePct = Math.round((humanScore / totalRounds) * 100)

  const BASE_URL  = typeof window !== 'undefined' ? window.location.origin : 'https://klyro.xyz'
  const shareText = humanWon
    ? `I just beat Axiom-7 AI ${humanScore}-${agentScore} in ${DIFFICULTY_CONFIG[difficulty].label} (${roundDuration}s rounds) on @KlyroHQ! Earned ${totalPts} pts · Badge: ${matchBadge.icon} ${matchBadge.label}. #Klyro #Mantle #HumanVsAI`
    : tied
    ? `Tied ${humanScore}-${agentScore} with Axiom-7 AI on @KlyroHQ — dead heat in ${DIFFICULTY_CONFIG[difficulty].label} (${roundDuration}s). Rematch incoming. #Klyro #Mantle #HumanVsAI`
    : `Axiom-7 AI beat me ${agentScore}-${humanScore} in ${DIFFICULTY_CONFIG[difficulty].label} (${roundDuration}s) on @KlyroHQ. Rematch time. #Klyro #Mantle #HumanVsAI`
  const shareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + '\n' + BASE_URL + '/challenge')}`

  return (
    <div className="min-h-screen overflow-y-auto" style={{ background: '#050508' }}>
      <div className="max-w-[540px] mx-auto px-5 pt-8 pb-16">

        {/* Breadcrumb */}
        <div className="font-mono text-[10px] uppercase tracking-[.18em] text-white/25 mb-7">
          {DIFFICULTY_CONFIG[difficulty].label} &middot; Final Report
        </div>

        {/* ── Hero card (Contra-style) ─────────────────────────────────── */}
        <div className="rounded-2xl p-6 mb-5"
          style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${accent}30` }}>
          <div className="flex items-start gap-4">

            {/* Left: big number + context */}
            <div className="flex-1 min-w-0">
              <div className="flex items-end gap-2 mb-1">
                <span className="font-display font-black leading-none"
                  style={{ fontSize: 64, color: accent, lineHeight: 1 }}>
                  {totalPts}
                </span>
                <span className="font-mono text-[14px] text-white/30 mb-2">pts</span>
              </div>
              <div className="font-display font-bold text-[17px] text-white leading-tight mb-1">
                {humanWon
                  ? `You beat Axiom-7 ${humanScore}–${agentScore}`
                  : tied
                  ? `Dead heat ${humanScore}–${agentScore}`
                  : `Axiom-7 won ${agentScore}–${humanScore}`}
              </div>
              <div className="font-mono text-[12px] text-white/35 leading-relaxed mb-3">
                {humanWon ? 'You out-predicted the machine.' : tied ? 'An even match.' : 'The algorithm prevailed.'}
              </div>
              <div className="font-mono text-[11px]" style={{ color: accent }}>
                {matchBadge.icon} {matchBadge.label} &middot; {DIFFICULTY_CONFIG[difficulty].label}
              </div>
            </div>

            {/* Right: circular badge ring */}
            <div className="relative shrink-0" style={{ width: 96, height: 96 }}>
              <svg viewBox="0 0 100 100" width={96} height={96}>
                {/* Track */}
                <circle cx="50" cy="50" r={RING_R} fill="none"
                  stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
                {/* Fill */}
                <circle cx="50" cy="50" r={RING_R} fill="none"
                  stroke={accent} strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={RING_CIRC * (1 - ringFill)}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50px 50px',
                    filter: `drop-shadow(0 0 4px ${accent}88)` }} />
              </svg>
              {/* Badge icon centred in ring */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span style={{ fontSize: 26, lineHeight: 1 }}>{matchBadge.icon}</span>
                <span className="font-mono text-[9px]" style={{ color: accent }}>{winRatePct}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section: Match performance grid ─────────────────────────── */}
        <div className="mb-1">
          <div className="font-display font-bold text-[18px] text-white mb-0.5">Match performance</div>
          <div className="font-mono text-[12px] text-white/35 mb-5">
            Understand your edge against Axiom-7.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <MetricCard
            label="Match Result"   impact="HIGH"
            value={`${humanScore} – ${agentScore}`}
            sub={humanWon ? 'Victory' : tied ? 'Draw' : 'Defeated'}
            color={accent}
          />
          <MetricCard
            label="Points Earned"  impact="HIGH"
            value={`${totalPts}`}
            sub="pts this match"
            color="#9A6BFF"
            icon="★"
          />
          <MetricCard
            label="Win Rate"       impact="HIGH"
            value={`${winRatePct}%`}
            sub={`${humanScore} / ${totalRounds} rounds`}
            color={winRatePct >= 50 ? '#10b981' : '#f43f5e'}
          />
          <MetricCard
            label="Round Duration" impact="HIGH"
            value={`${roundDuration}s`}
            sub={`${getDurationMultiplier(roundDuration)}× pts multiplier`}
            color="#fbbf24"
            icon="⚡"
          />
          <MetricCard
            label="Strategy"       impact="MEDIUM"
            value={analysis.strategyType}
            sub={`${upCalls}↑ / ${downCalls}↓ calls`}
            color="white"
          />
          <MetricCard
            label="Difficulty"     impact="MEDIUM"
            value={DIFFICULTY_CONFIG[difficulty].label}
            sub={`${totalRounds} rounds`}
            color="white"
            icon={DIFFICULTY_CONFIG[difficulty].icon}
          />
        </div>

        {/* ── Round breakdown ──────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="font-display font-bold text-[18px] text-white mb-0.5">Round breakdown</div>
          <div className="font-mono text-[12px] text-white/35 mb-4">
            Every call you made against the AI.
          </div>
          <div className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            {records.map((r, i) => {
              const rc = r.verdict === 'win' ? '#10b981' : r.verdict === 'lose' ? '#f43f5e' : '#fbbf24'
              return (
                <div key={r.roundNum}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: i < records.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <div className="w-7 h-7 rounded-full grid place-items-center font-mono text-[11px] font-bold shrink-0"
                    style={{ background: `${rc}20`, color: rc }}>
                    {r.roundNum}
                  </div>
                  <div className="flex-1 font-mono text-[11px] text-white/45 leading-relaxed">
                    You <span style={{ color: r.humanCall === 'up' ? '#10b981' : '#f43f5e' }}>
                      {r.humanCall === 'up' ? '▲' : '▼'}
                    </span>{' vs '}AI <span style={{ color: r.agentCall === 'up' ? '#10b981' : '#f43f5e' }}>
                      {r.agentCall === 'up' ? '▲' : '▼'}
                    </span>
                    <span className="text-white/25"> · ETH {r.outcome === 'up' ? '▲' : '▼'} {r.delta}</span>
                  </div>
                  <div className="w-7 h-7 rounded-full grid place-items-center font-mono text-[10px] font-bold shrink-0"
                    style={{ background: `${rc}15`, color: rc }}>
                    {r.verdict === 'win' ? 'W' : r.verdict === 'lose' ? 'L' : 'D'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="space-y-2.5">
          <a href={shareUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-mono text-[12px] font-bold uppercase tracking-[.07em] text-white transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.11)' }}>
            <svg width="14" height="14" viewBox="0 0 1200 1227" fill="currentColor">
              <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/>
            </svg>
            Share result on X
          </a>

          <button onClick={onRematch}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-[13px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97]"
            style={{ background: 'linear-gradient(135deg,#6C2BF2,#7c3af5)',
              boxShadow: '0 0 28px rgba(108,43,242,0.4)' }}>
            {humanWon ? '🏆  Claim Harder Difficulty' : '🔄  Rematch'}
          </button>

          <button onClick={onHome}
            className="w-full py-2 rounded-xl font-mono text-[11px] text-white/30 hover:text-white/55 transition-colors">
            ← Back to Arena
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Main ChallengeView ───────────────────────────────────────────────────────

export function ChallengeView() {
  const [difficulty,     setDifficulty]     = useState<Difficulty>('best-of-3')
  const [roundDuration,  setRoundDuration]  = useState(30)
  const [challengePhase, setChallengePhase] = useState<ChallengePhase>('pick')
  const [records,        setRecords]        = useState<RoundRecord[]>([])
  const [humanScore,     setHumanScore]     = useState(0)
  const [agentScore,     setAgentScore]     = useState(0)
  const [currentRound,   setCurrentRound]   = useState(1)
  const [lastRecord,     setLastRecord]     = useState<RoundRecord | null>(null)

  const totalRounds = DIFFICULTY_CONFIG[difficulty].rounds

  // We only need these three from the store — everything else ArenaView handles
  const mockPhase      = useRoundStore(s => s.phase)
  const mockLastResult = useRoundStore(s => s.lastResult)
  const startMockRound = useRoundStore(s => s.startRound)
  const resetMock      = useRoundStore(s => s.resetToIdle)

  // Detect round resolution — transition to between-round screen
  useEffect(() => {
    if (mockPhase !== 'resolved' || challengePhase !== 'playing' || !mockLastResult) return

    const { humanCall, agentCall, outcome, deltaText } = mockLastResult

    // Head-to-head verdict: win only when human right AND agent wrong
    const humanRight = humanCall === outcome
    const agentRight = agentCall === outcome
    let verdict: 'win' | 'lose' | 'draw'
    if (humanCall === agentCall)        verdict = 'draw'
    else if (humanRight && !agentRight) verdict = 'win'
    else if (!humanRight && agentRight) verdict = 'lose'
    else                                verdict = 'draw'

    const newRecord: RoundRecord = {
      roundNum: currentRound,
      humanCall, agentCall, outcome, verdict,
      delta: deltaText,
    }

    setRecords(prev => [...prev, newRecord])
    setHumanScore(prev => prev + (verdict === 'win' ? 1 : 0))
    setAgentScore(prev => prev + (verdict === 'lose' ? 1 : 0))
    setLastRecord(newRecord)
    setChallengePhase('between')
  }, [mockPhase]) // eslint-disable-line

  // ── Actions ───────────────────────────────────────────────────────────────

  function handleStart() {
    resetMock()
    setRecords([])
    setHumanScore(0)
    setAgentScore(0)
    setCurrentRound(1)
    setLastRecord(null)
    // Start round immediately so ArenaView renders in mOpen state (no idle flash)
    startMockRound('ETH/USD', roundDuration)
    setChallengePhase('playing')
  }

  function handleNextRound() {
    // Read scores directly from state (already updated by the useEffect)
    const matchDecided = humanScore > Math.floor(totalRounds / 2) ||
                         agentScore > Math.floor(totalRounds / 2)

    if (currentRound >= totalRounds || matchDecided) {
      setChallengePhase('final')
    } else {
      setCurrentRound(r => r + 1)
      resetMock()
      // Start next round immediately so ArenaView renders in mOpen on mount
      startMockRound('ETH/USD', roundDuration)
      setChallengePhase('playing')
    }
  }

  function handleRematch() {
    resetMock()
    setRecords([])
    setHumanScore(0)
    setAgentScore(0)
    setCurrentRound(1)
    setLastRecord(null)
    setChallengePhase('pick')
  }

  // ── Difficulty picker ──────────────────────────────────────────────────────

  if (challengePhase === 'pick') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
        style={{ background: '#050508' }}>
        <div className="w-full max-w-[440px]">

          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5"
              style={{ background: 'rgba(108,43,242,0.15)', border: '1px solid rgba(108,43,242,0.3)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#6C2BF2] animate-pulse" />
              <span className="font-mono text-[10px] tracking-[.18em] uppercase text-[#9A6BFF]">Challenge Mode · Human vs AI</span>
            </div>
            <h1 className="font-mono font-black text-[36px] tracking-[-0.02em] text-white leading-tight mb-3">
              Gauntlet Mode
            </h1>
            <p className="font-mono text-[13px] text-white/40 leading-relaxed max-w-[340px] mx-auto">
              Multi-round series against Axiom-7. Track your score across every round.
              Pick your difficulty and duration.
            </p>
          </div>

          {/* Difficulty cards */}
          <div className="space-y-3 mb-8">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setDifficulty(key)}
                className="w-full rounded-2xl p-5 text-left transition-all active:scale-[.99]"
                style={{
                  background:  difficulty === key ? `${cfg.color}15` : 'rgba(255,255,255,0.02)',
                  border:      `1px solid ${difficulty === key ? cfg.color + '55' : 'rgba(255,255,255,0.07)'}`,
                  boxShadow:   difficulty === key ? `0 0 20px ${cfg.color}18` : 'none',
                }}>
                <div className="flex items-center gap-3">
                  <span className="text-[28px]">{cfg.icon}</span>
                  <div className="flex-1">
                    <div className="font-mono font-bold text-[16px] text-white mb-0.5">{cfg.label}</div>
                    <div className="font-mono text-[11px] text-white/40">{cfg.desc}</div>
                  </div>
                  <div className="w-5 h-5 rounded-full border-2 grid place-items-center shrink-0"
                    style={{ borderColor: difficulty === key ? cfg.color : 'rgba(255,255,255,0.15)' }}>
                    {difficulty === key && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Duration picker */}
          <div className="mb-5">
            <div className="font-mono text-[9px] tracking-[.16em] uppercase text-white/25 mb-2 text-center">Round duration</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { s: 15, label: '15s', bonus: '4×' },
                { s: 30, label: '30s', bonus: '2×' },
                { s: 45, label: '45s', bonus: '1.5×' },
                { s: 60, label: '60s', bonus: '1×' },
              ].map(({ s, label, bonus }) => {
                const active = roundDuration === s
                return (
                  <button key={s} onClick={() => setRoundDuration(s)}
                    className="flex flex-col items-center py-2.5 rounded-xl transition-all"
                    style={{
                      background: active ? 'rgba(108,43,242,0.22)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${active ? 'rgba(108,43,242,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    <span className="font-mono font-bold text-[13px]"
                      style={{ color: active ? '#9A6BFF' : 'rgba(255,255,255,0.45)' }}>{label}</span>
                    <span className="font-mono text-[9px] mt-0.5"
                      style={{ color: active ? '#6C2BF2' : 'rgba(255,255,255,0.2)' }}>{bonus} pts</span>
                  </button>
                )
              })}
            </div>
            <div className="font-mono text-[9px] text-white/20 mt-1.5 text-center">
              faster = more pts · {roundDuration}s × {getDurationMultiplier(roundDuration)} = {calcPoints('win', roundDuration)} pts/win
            </div>
          </div>

          <button onClick={handleStart}
            className="w-full py-4 rounded-xl font-mono font-bold text-[14px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97]"
            style={{ background: 'linear-gradient(135deg, #6C2BF2, #7c3af5)',
              boxShadow: '0 0 32px rgba(108,43,242,0.55)' }}>
            {DIFFICULTY_CONFIG[difficulty].icon} Start {DIFFICULTY_CONFIG[difficulty].label} ({roundDuration}s) →
          </button>

          <div className="text-center mt-4">
            <Link href="/arena"
              className="font-mono text-[11px] text-white/25 hover:text-white/50 transition-colors">
              ← Back to single round
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Playing — full ArenaView + challenge HUD overlay ──────────────────────

  if (challengePhase === 'playing') {
    return (
      <div className="relative">
        {/* Full Arena interface — identical to Arena mode, forced into mock mode */}
        <ArenaView gauntletMode={true} />

        {/* Challenge progress HUD — fixed pill just below the arena top strip */}
        <div
          className="fixed z-30 flex items-center gap-3 px-4 py-1.5 rounded-full pointer-events-none"
          style={{
            top: '112px',   // nav 64px + top strip 44px + 4px gap
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(2,4,10,0.92)',
            border: '1px solid rgba(108,43,242,0.4)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 0 20px rgba(108,43,242,0.2)',
          }}
        >
          {/* Series progress */}
          <span className="font-mono text-[10px] text-white/45 uppercase tracking-[.12em]">
            Round
          </span>
          <span className="font-mono font-bold text-[11px] text-white">
            {currentRound}/{totalRounds}
          </span>

          {/* Divider */}
          <span className="w-px h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />

          {/* Scores */}
          <span className="font-display font-black text-[15px] text-[#10b981]">{humanScore}</span>
          <span className="font-mono text-[11px] text-white/20">—</span>
          <span className="font-display font-black text-[15px] text-[#f43f5e]">{agentScore}</span>

          {/* Divider */}
          <span className="w-px h-3 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />

          {/* Duration */}
          <span className="font-mono text-[10px] text-white/30">{roundDuration}s</span>
        </div>
      </div>
    )
  }

  // ── Between rounds ─────────────────────────────────────────────────────────

  if (challengePhase === 'between' && lastRecord) {
    return (
      <div className="min-h-screen" style={{ background: '#02040A' }}>
        <BetweenRoundCard
          record={lastRecord}
          humanScore={humanScore}
          agentScore={agentScore}
          totalRounds={totalRounds}
          roundNum={currentRound}
          onNext={handleNextRound}
        />
      </div>
    )
  }

  // ── Final report ───────────────────────────────────────────────────────────

  if (challengePhase === 'final') {
    return (
      <FinalReport
        records={records}
        humanScore={humanScore}
        agentScore={agentScore}
        totalRounds={totalRounds}
        difficulty={difficulty}
        roundDuration={roundDuration}
        onRematch={handleRematch}
        onHome={() => { resetMock(); window.location.href = '/arena' }}
      />
    )
  }

  return null
}
