'use client'

/**
 * ChallengeView — Multi-round "Gauntlet" mode inspired by TradeMirror AI.
 *
 * Flow:
 *   1. Difficulty picker (Best of 3 / Best of 5)
 *   2. Rounds play one after another — each uses the real on-chain game
 *   3. Between rounds: score card + "next round" CTA
 *   4. Final report: human score vs Axiom-7 score, strategy type, badge, Share to X
 *
 * This component wraps ArenaView in challenge mode by managing the outer
 * round-series state. The actual per-round betting is delegated to
 * the mock store for simplicity (no extra contracts needed).
 */

import { useState, useEffect, useRef } from 'react'
import { useRoundStore, type Call } from '@/lib/store/roundStore'
import { useIdlePriceTick } from '@/lib/hooks/useIdlePriceTick'
import { classifyBattle, calcPoints, getDurationMultiplier } from '@/components/arena/ResultModal'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────────────

type Difficulty = 'best-of-3' | 'best-of-5'
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

// ── Mini betting panel (used within challenge flow) ───────────────────────────

function BettingPanel({
  roundNum, totalRounds, humanScore, agentScore,
  onCall, humanCall, agentCall, secondsLeft, totalSeconds,
  formattedPrice, deltaText, deltaIsUp, asset, phase,
}: {
  roundNum: number; totalRounds: number; humanScore: number; agentScore: number
  onCall: (c: Call) => void; humanCall: Call | null; agentCall: Call | null
  secondsLeft: number; totalSeconds: number
  formattedPrice: string; deltaText: string; deltaIsUp: boolean
  asset: string; phase: string
}) {
  const pct = Math.max(0, secondsLeft / Math.max(totalSeconds, 1))
  const CIRC = 2 * Math.PI * 28
  const offset = CIRC * (1 - pct)
  const warn = secondsLeft > 0 && secondsLeft <= 10
  const ringColor = warn ? '#fbbf24' : '#00ff9d'

  return (
    <div className="rounded-2xl p-5 w-full max-w-[320px]"
      style={{ background: 'rgba(2,4,10,0.97)', border: '1px solid rgba(108,43,242,0.3)',
        backdropFilter: 'blur(22px)', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>

      {/* Score row */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center">
          <div className="font-mono text-[9px] text-white/30 uppercase tracking-[.12em] mb-0.5">You</div>
          <div className="font-display font-black text-[28px] text-[#10b981]">{humanScore}</div>
        </div>
        <div className="flex flex-col items-center">
          <div className="font-mono text-[9px] text-white/25 uppercase tracking-[.1em]">
            Round {roundNum}/{totalRounds}
          </div>
          <div className="font-mono text-[11px] text-white/40 mt-0.5">{formattedPrice}</div>
          {deltaText && phase === 'open' && (
            <div className={`font-mono text-[10px] font-semibold ${deltaIsUp ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
              {deltaIsUp ? '▲' : '▼'} {deltaText.replace(/^[+-]/, '')}
            </div>
          )}
        </div>
        <div className="text-center">
          <div className="font-mono text-[9px] text-white/30 uppercase tracking-[.12em] mb-0.5">Axiom-7</div>
          <div className="font-display font-black text-[28px] text-[#f43f5e]">{agentScore}</div>
        </div>
      </div>

      {/* Countdown ring + action area */}
      {phase === 'open' && !humanCall && (
        <>
          {/* Countdown */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <svg viewBox="0 0 64 64" width={64} height={64} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={ringColor} strokeWidth="5"
                strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.9s linear', filter: `drop-shadow(0 0 4px ${ringColor}88)` }} />
            </svg>
            <div>
              <div className="font-display font-black text-[36px] leading-none tabular-nums"
                style={{ color: ringColor }}>{secondsLeft}</div>
              <div className="font-mono text-[9px] uppercase tracking-[.14em] text-white/30">secs left</div>
            </div>
          </div>
          {/* Call buttons */}
          <div className="font-mono text-[11px] text-white/40 text-center mb-3">
            Will <span className="text-white font-semibold">{asset.split('/')[0]}</span> go higher or lower?
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={() => onCall('up')}
              className="flex flex-col items-center py-5 rounded-xl transition-all active:scale-[.95]"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.30)', color: '#10b981' }}>
              <span className="text-[26px] leading-none mb-1">▲</span>
              <span className="font-display font-black text-[15px] uppercase">Higher</span>
              <small className="font-mono text-[9px] opacity-55 mt-0.5">price rises</small>
            </button>
            <button onClick={() => onCall('down')}
              className="flex flex-col items-center py-5 rounded-xl transition-all active:scale-[.95]"
              style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.30)', color: '#f43f5e' }}>
              <span className="text-[26px] leading-none mb-1">▼</span>
              <span className="font-display font-black text-[15px] uppercase">Lower</span>
              <small className="font-mono text-[9px] opacity-55 mt-0.5">price falls</small>
            </button>
          </div>
        </>
      )}

      {/* Locked state */}
      {phase === 'open' && humanCall && (
        <>
          <div className="mb-3 px-4 py-3 rounded-xl border"
            style={{ borderColor: humanCall === 'up' ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)',
              background: humanCall === 'up' ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)' }}>
            <div className="font-mono text-[10px] text-white/35 uppercase tracking-[.1em] mb-1">Your call</div>
            <div className="font-display font-black text-[18px]"
              style={{ color: humanCall === 'up' ? '#10b981' : '#f43f5e' }}>
              {humanCall === 'up' ? '▲ HIGHER' : '▼ LOWER'}
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03]">
            <div className="w-6 h-6 rounded-md grid place-items-center font-display font-black text-[10px] text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6C2BF2, #9A6BFF)' }}>AX</div>
            <div className="flex-1 font-mono text-[11px]">
              {agentCall
                ? <span style={{ color: agentCall === 'up' ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                    {agentCall === 'up' ? '▲ HIGHER' : '▼ LOWER'}
                  </span>
                : <span className="text-white/30 animate-pulse">Thinking…</span>}
            </div>
            <span className="font-mono text-[9px] text-white/25">Axiom-7</span>
          </div>
          <div className="mt-3 font-mono text-[10px] text-center text-white/30 animate-pulse uppercase tracking-[.08em]">
            Waiting for round to close…
          </div>
          {/* Countdown rings while locked */}
          <div className="flex justify-center mt-3">
            <svg viewBox="0 0 64 64" width={48} height={48} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" />
              <circle cx="32" cy="32" r="28" fill="none" stroke={ringColor} strokeWidth="5"
                strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.9s linear' }} />
            </svg>
          </div>
        </>
      )}
    </div>
  )
}

// ── Between-round card ───────────────────────────────────────────────────────

function BetweenRoundCard({
  record, humanScore, agentScore, totalRounds, roundNum, onNext,
}: {
  record: RoundRecord; humanScore: number; agentScore: number
  totalRounds: number; roundNum: number; onNext: () => void
}) {
  const accent = record.verdict === 'win' ? '#10b981'
    : record.verdict === 'lose' ? '#f43f5e' : '#fbbf24'
  const isLast = roundNum >= totalRounds
  const humanWinning = humanScore > agentScore
  const tied = humanScore === agentScore

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
            <div className="font-mono text-[10px] text-white/30 uppercase tracking-[.1em] mb-3">Score</div>
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
                : tied ? '⚖️ Tied — this next round decides momentum'
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

// ── Final challenge report ────────────────────────────────────────────────────

function FinalReport({
  records, humanScore, agentScore, totalRounds, difficulty, roundDuration, onRematch, onHome,
}: {
  records: RoundRecord[]; humanScore: number; agentScore: number
  totalRounds: number; difficulty: Difficulty; roundDuration: number
  onRematch: () => void; onHome: () => void
}) {
  const humanWon = humanScore > agentScore
  const tied = humanScore === agentScore

  // Total pts earned this match
  const totalPts = records.reduce((sum, r) => sum + calcPoints(r.verdict, roundDuration), 0)

  // Overall strategy: most common call direction
  const upCalls = records.filter(r => r.humanCall === 'up').length
  const downCalls = records.length - upCalls
  const analysis = records.length > 0
    ? classifyBattle(
        records[records.length - 1].humanCall,
        records[records.length - 1].agentCall,
        records[records.length - 1].outcome,
        records[records.length - 1].verdict,
      )
    : { strategyType: 'Unknown', strategyDesc: '', badge: 'Challenger', badgeIcon: '⚡' }

  // Override badge based on match result
  const matchBadge = humanWon && humanScore === totalRounds ? { icon: '👑', label: 'Perfect Run' }
    : humanWon ? { icon: '🗡️', label: 'AI Slayer' }
    : tied ? { icon: '🤝', label: 'Dead Heat' }
    : agentScore === totalRounds ? { icon: '🤖', label: 'Dominated' }
    : { icon: '↑', label: 'Next Time' }

  const accent = humanWon ? '#10b981' : tied ? '#fbbf24' : '#f43f5e'

  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://klyro.xyz'
  const shareText = humanWon
    ? `I just beat Axiom-7 AI ${humanScore}-${agentScore} in ${DIFFICULTY_CONFIG[difficulty].label} (${roundDuration}s rounds) on @KlyroHQ! Earned ${totalPts} pts · Badge: ${matchBadge.icon} ${matchBadge.label}. #Klyro #Mantle #HumanVsAI`
    : tied
    ? `Tied ${humanScore}-${agentScore} with Axiom-7 AI on @KlyroHQ — dead heat in ${DIFFICULTY_CONFIG[difficulty].label} (${roundDuration}s). Rematch incoming. #Klyro #Mantle #HumanVsAI`
    : `Axiom-7 AI beat me ${agentScore}-${humanScore} in ${DIFFICULTY_CONFIG[difficulty].label} (${roundDuration}s) on @KlyroHQ. Rematch time. #Klyro #Mantle #HumanVsAI`
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + '\n' + BASE_URL + '/challenge')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(2,4,10,0.98)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-[360px] rounded-2xl overflow-hidden my-4"
        style={{ background: 'rgba(255,255,255,0.025)', border: `1px solid ${accent}44`,
          boxShadow: `0 0 80px ${accent}22, 0 24px 60px rgba(0,0,0,0.8)` }}>

        {/* Header */}
        <div className="px-5 pt-6 pb-4 text-center border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="font-mono text-[10px] text-white/30 uppercase tracking-[.16em] mb-2">
            {DIFFICULTY_CONFIG[difficulty].label} · Final Report
          </div>
          <div className="font-display font-black text-[42px] leading-none uppercase"
            style={{ color: accent, textShadow: `0 0 40px ${accent}55` }}>
            {humanWon ? 'Victory!' : tied ? 'Draw!' : 'Defeated'}
          </div>
          <div className="font-mono text-[13px] text-white/40 mt-2">
            {humanWon ? 'You out-predicted the machine.' : tied ? 'An even match.' : 'The algorithm prevailed.'}
          </div>
        </div>

        {/* Score */}
        <div className="px-5 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-center gap-8 mb-4">
            <div className="text-center">
              <div className="font-display font-black text-[56px] leading-none text-[#10b981]">{humanScore}</div>
              <div className="font-mono text-[11px] text-white/30 mt-1 uppercase tracking-[.1em]">You</div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="font-mono text-[22px] text-white/15 font-bold">vs</div>
              <div className="font-mono text-[9px] text-white/20 uppercase tracking-[.1em]">{totalRounds} rounds</div>
            </div>
            <div className="text-center">
              <div className="font-display font-black text-[56px] leading-none text-[#f43f5e]">{agentScore}</div>
              <div className="font-mono text-[11px] text-white/30 mt-1 uppercase tracking-[.1em]">Axiom-7</div>
            </div>
          </div>

          {/* Total pts */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="font-mono text-[11px] text-white/25">Total earned:</div>
            <div className="font-mono font-bold text-[16px]" style={{ color: '#9A6BFF' }}>{totalPts} pts</div>
            <div className="font-mono text-[10px] text-white/20">({roundDuration}s rounds)</div>
          </div>

          {/* Match badge */}
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl mx-4"
            style={{ background: `${accent}12`, border: `1px solid ${accent}25` }}>
            <span className="text-[22px]">{matchBadge.icon}</span>
            <div>
              <div className="font-mono font-bold text-[14px]" style={{ color: accent }}>{matchBadge.label}</div>
              <div className="font-mono text-[10px] text-white/30">Match badge earned</div>
            </div>
          </div>
        </div>

        {/* Round breakdown */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="font-mono text-[9px] text-white/25 uppercase tracking-[.14em] mb-3">Round breakdown</div>
          <div className="space-y-2">
            {records.map(r => {
              const rc = r.verdict === 'win' ? '#10b981' : r.verdict === 'lose' ? '#f43f5e' : '#fbbf24'
              return (
                <div key={r.roundNum} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full grid place-items-center font-mono text-[10px] font-bold shrink-0"
                    style={{ background: `${rc}22`, color: rc }}>{r.roundNum}</div>
                  <div className="flex-1 font-mono text-[11px] text-white/50">
                    You {r.humanCall === 'up' ? '▲' : '▼'} vs AI {r.agentCall === 'up' ? '▲' : '▼'}
                    {' · '}ETH {r.outcome === 'up' ? '▲' : '▼'} {r.delta}
                  </div>
                  <div className="font-mono text-[11px] font-bold shrink-0" style={{ color: rc }}>
                    {r.verdict === 'win' ? 'W' : r.verdict === 'lose' ? 'L' : 'D'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Strategy */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="font-mono text-[9px] text-white/25 uppercase tracking-[.14em] mb-2">Your strategy profile</div>
          <div className="flex items-center gap-3">
            <div>
              <div className="font-mono font-bold text-[13px] text-white">{analysis.strategyType}</div>
              <div className="font-mono text-[10px] text-white/30">{upCalls}↑ / {downCalls}↓ calls this session</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 space-y-2.5">
          {/* Share to X */}
          <a href={shareUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-mono text-[12px] font-bold uppercase tracking-[.07em] text-white transition-opacity hover:opacity-80"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <svg width="14" height="14" viewBox="0 0 1200 1227" fill="currentColor">
              <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/>
            </svg>
            Share Result on X
          </a>

          <button onClick={onRematch}
            className="w-full py-3 rounded-xl font-mono font-bold text-[12px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97]"
            style={{ background: 'linear-gradient(135deg,#6C2BF2,#7c3af5)', boxShadow: '0 0 24px rgba(108,43,242,0.4)' }}>
            {humanWon ? '🏆  Claim Harder Difficulty' : '🔄  Rematch'}
          </button>

          <button onClick={onHome}
            className="w-full py-2 rounded-xl font-mono text-[11px] text-white/30 hover:text-white/60 transition-colors">
            ← Back to Arena
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ChallengeView ───────────────────────────────────────────────────────

export function ChallengeView() {
  const [difficulty,      setDifficulty]      = useState<Difficulty>('best-of-3')
  const [roundDuration,   setRoundDuration]   = useState(30)   // seconds per round
  const [challengePhase,  setChallengePhase]  = useState<ChallengePhase>('pick')
  const [records,         setRecords]         = useState<RoundRecord[]>([])
  const [humanScore,      setHumanScore]      = useState(0)
  const [agentScore,      setAgentScore]      = useState(0)
  const [currentRound,    setCurrentRound]    = useState(1)
  const [lastRecord,      setLastRecord]      = useState<RoundRecord | null>(null)

  // Mock store for the actual in-round game
  useIdlePriceTick()
  const mockPhase     = useRoundStore(s => s.phase)
  const mockAsset     = useRoundStore(s => s.asset)
  const mockFormattedPrice = useRoundStore(s => s.formattedPrice)
  const mockDeltaText = useRoundStore(s => s.deltaText)
  const mockDeltaIsUp = useRoundStore(s => s.deltaIsUp)
  const mockSecondsLeft = useRoundStore(s => s.secondsLeft)
  const mockTotalSeconds = useRoundStore(s => s.totalSeconds)
  const mockHumanCall = useRoundStore(s => s.humanCall)
  const mockAgentCall = useRoundStore(s => s.agentCall)
  const mockLastResult = useRoundStore(s => s.lastResult)
  const startMockRound = useRoundStore(s => s.startRound)
  const makeMockCall   = useRoundStore(s => s.makeCall)
  const resetMock      = useRoundStore(s => s.resetToIdle)

  const totalRounds = DIFFICULTY_CONFIG[difficulty].rounds

  // Auto-start round when phase enters 'playing' (each new round after between-screen)
  const roundStarted = useRef(false)

  useEffect(() => {
    if (challengePhase === 'playing' && mockPhase === 'idle' && !roundStarted.current) {
      roundStarted.current = true
      startMockRound('ETH/USD', roundDuration)
    }
  }, [challengePhase, mockPhase, startMockRound])

  // Detect round resolution
  useEffect(() => {
    if (mockPhase === 'resolved' && challengePhase === 'playing' && mockLastResult) {
      const { humanWon, humanCall, agentCall, outcome, deltaText } = mockLastResult

      // Determine verdict (head-to-head: only win if human right AND agent wrong)
      const humanRight = humanCall === outcome
      const agentRight = agentCall === outcome
      let verdict: 'win' | 'lose' | 'draw'
      if (humanCall === agentCall) verdict = 'draw'
      else if (humanRight && !agentRight) verdict = 'win'
      else if (!humanRight && agentRight) verdict = 'lose'
      else verdict = 'draw'

      const newRecord: RoundRecord = {
        roundNum: currentRound,
        humanCall, agentCall, outcome, verdict,
        delta: deltaText,
      }

      const newHumanScore = humanScore + (verdict === 'win' ? 1 : 0)
      const newAgentScore = agentScore + (verdict === 'lose' ? 1 : 0)

      setRecords(prev => [...prev, newRecord])
      setHumanScore(newHumanScore)
      setAgentScore(newAgentScore)
      setLastRecord(newRecord)

      // Check if match is decided early (can't catch up)
      const roundsLeft = totalRounds - currentRound
      const matchDecided = newHumanScore > Math.floor(totalRounds / 2) ||
                           newAgentScore > Math.floor(totalRounds / 2) ||
                           currentRound >= totalRounds

      roundStarted.current = false
      setChallengePhase('between')

      if (matchDecided || currentRound >= totalRounds) {
        // Will go to final on "next" click
      }
    }
  }, [mockPhase]) // eslint-disable-line

  function handleStart() {
    resetMock()
    setRecords([])
    setHumanScore(0)
    setAgentScore(0)
    setCurrentRound(1)
    setLastRecord(null)
    roundStarted.current = false
    setChallengePhase('playing')
  }

  function handleNextRound() {
    const roundsLeft = totalRounds - currentRound
    const matchDecided = humanScore > Math.floor(totalRounds / 2) ||
                         agentScore > Math.floor(totalRounds / 2)

    if (currentRound >= totalRounds || matchDecided) {
      setChallengePhase('final')
    } else {
      setCurrentRound(r => r + 1)
      resetMock()
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
    roundStarted.current = false
    setChallengePhase('pick')
  }

  // ── Difficulty picker ────────────────────────────────────────────────────

  if (challengePhase === 'pick') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16"
        style={{ background: '#050508' }}>
        <div className="w-full max-w-[440px]">

          {/* Header */}
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
              Pick your difficulty.
            </p>
          </div>

          {/* Difficulty cards */}
          <div className="space-y-3 mb-8">
            {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, cfg]) => (
              <button key={key} onClick={() => setDifficulty(key)}
                className="w-full rounded-2xl p-5 text-left transition-all active:scale-[.99]"
                style={{
                  background: difficulty === key ? `${cfg.color}15` : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${difficulty === key ? cfg.color + '55' : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: difficulty === key ? `0 0 20px ${cfg.color}18` : 'none',
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
              faster = more pts per win · {roundDuration}s × {getDurationMultiplier(roundDuration)} = {calcPoints('win', roundDuration)} pts/win
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

  // ── Playing ──────────────────────────────────────────────────────────────

  if (challengePhase === 'playing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: '#02040A' }}>
        <BettingPanel
          roundNum={currentRound}
          totalRounds={totalRounds}
          humanScore={humanScore}
          agentScore={agentScore}
          onCall={makeMockCall}
          humanCall={mockHumanCall}
          agentCall={mockAgentCall}
          secondsLeft={mockSecondsLeft}
          totalSeconds={mockTotalSeconds}
          formattedPrice={mockFormattedPrice}
          deltaText={mockDeltaText}
          deltaIsUp={mockDeltaIsUp}
          asset={mockAsset}
          phase={mockPhase === 'open' ? 'open' : 'idle'}
        />
      </div>
    )
  }

  // ── Between rounds ────────────────────────────────────────────────────────

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

  // ── Final report ──────────────────────────────────────────────────────────

  if (challengePhase === 'final') {
    return (
      <div className="min-h-screen" style={{ background: '#02040A' }}>
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
      </div>
    )
  }

  return null
}
