'use client'

import { useState, useEffect, useRef } from 'react'
import type { Call } from '@/lib/store/roundStore'

// ── Messages ──────────────────────────────────────────────────────────────────

const WIN_MSGS = [
  'The AI is writing its resignation letter 🤖',
  'Axiom-7 is in shambles. You destroyed it.',
  'Peak performance. The algorithm weeps.',
  'Skill issue for the bot. You cooked.',
  'Touch grass? Never. Win again? Always.',
]

const LOSE_MSGS = [
  'The AI is doing a victory lap. Embarrassing.',
  'Axiom-7 predicted your failure. It was right.',
  'L + ratio + you got rekt by a bot 💀',
  'The algorithm sends its regards. (It\'s laughing.)',
  'Even the RNG felt bad for you.',
]

const DRAW_MSGS = [
  'You two have the same brain cell, apparently.',
  'Great minds think alike. Or great idiots.',
  'The AI copied your homework. Classic.',
  'Synchronized stupidity / genius. Unclear which.',
  'Call it a truce. For now.',
]

// ── Canvas confetti (win) ─────────────────────────────────────────────────────

interface Piece {
  x: number; y: number; vx: number; vy: number
  color: string; w: number; h: number; rot: number; rv: number
}

function useConfetti(active: boolean, canvasRef: React.RefObject<HTMLCanvasElement>) {
  const pieces = useRef<Piece[]>([])
  const raf = useRef(0)
  const frame = useRef(0)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const cv = canvas

    const palette = ['#10b981','#34d399','#fbbf24','#f59e0b','#9A6BFF','#6C2BF2','#00ff9d','#fff','#f472b6','#60a5fa']
    pieces.current = [0.3, 0.7].flatMap(ox =>
      Array.from({ length: 90 }, () => ({
        x: cv.width * ox + (Math.random() - 0.5) * 40,
        y: cv.height * 0.35,
        vx: (Math.random() - 0.5) * 12,
        vy: -(6 + Math.random() * 10),
        color: palette[Math.floor(Math.random() * palette.length)],
        w: 6 + Math.random() * 10, h: 4 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2, rv: (Math.random() - 0.5) * 0.25,
      }))
    )

    function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height)
      frame.current++
      pieces.current = pieces.current.filter(p => p.y < cv.height + 30)
      for (const p of pieces.current) {
        p.vy += 0.22; p.vx *= 0.99
        p.x += p.vx + Math.sin(frame.current * 0.04 + p.y * 0.01) * 0.8
        p.y += p.vy; p.rot += p.rv
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - p.y / (cv.height * 1.1))
        ctx.translate(p.x, p.y); ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (pieces.current.length > 0) raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf.current); pieces.current = [] }
  }, [active, canvasRef])
}

// ── Canvas rain (lose) ────────────────────────────────────────────────────────

interface Drop { x: number; y: number; speed: number; len: number; alpha: number }

function useRain(active: boolean, canvasRef: React.RefObject<HTMLCanvasElement>) {
  const drops = useRef<Drop[]>([])
  const raf = useRef(0)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const cv = canvas

    drops.current = Array.from({ length: 80 }, () => ({
      x: Math.random() * cv.width, y: Math.random() * cv.height,
      speed: 4 + Math.random() * 6, len: 12 + Math.random() * 20,
      alpha: 0.15 + Math.random() * 0.35,
    }))

    function draw() {
      ctx.clearRect(0, 0, cv.width, cv.height)
      for (const d of drops.current) {
        d.y += d.speed
        if (d.y > cv.height + d.len) d.y = -d.len
        ctx.save(); ctx.globalAlpha = d.alpha; ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - 1, d.y + d.len); ctx.stroke()
        ctx.restore()
      }
      raf.current = requestAnimationFrame(draw)
    }
    raf.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf.current)
  }, [active, canvasRef])
}

// ── Animated hero ─────────────────────────────────────────────────────────────

function AnimatedHero({ verdict }: { verdict: 'win' | 'lose' | 'draw' }) {
  const emojiSets = {
    win:  ['🏆','💰','🎉','✨','🚀','💎','🔥','🤑'],
    lose: ['💀','😭','📉','🤡','💸','🪦','😤','🤮'],
    draw: ['🤝','😐','🎲','🔁','🤷','⚖️','🫱','🫲'],
  }
  const centerEmoji = { win: '🏆', lose: '💀', draw: '🤝' }
  const emojis = emojiSets[verdict]
  const glowColor = verdict === 'win' ? 'rgba(16,185,129,0.25)'
    : verdict === 'lose' ? 'rgba(244,63,94,0.25)'
    : 'rgba(251,191,36,0.25)'

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden select-none">
      <div className="absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 50%, ${glowColor} 0%, transparent 70%)` }} />

      {emojis.map((e, i) => {
        const angle = (i / emojis.length) * 360
        const delay = i * 0.07
        const dist  = 62 + (i % 2) * 18
        const animName = verdict === 'win' ? 'heroOrbitWin'
          : verdict === 'lose' ? 'heroOrbitLose'
          : 'heroOrbitDraw'
        return (
          <div key={i} className="absolute text-[22px] leading-none"
            style={{
              animation: `${animName} 3.2s ease-in-out ${delay}s infinite`,
              transform: `rotate(${angle}deg) translateX(${dist}px) rotate(-${angle}deg)`,
            }}>
            {e}
          </div>
        )
      })}

      <div className="relative z-10 text-[72px] leading-none"
        style={{ animation: 'heroCenterPop 0.6s cubic-bezier(0.34,1.56,0.64,1) both' }}>
        {centerEmoji[verdict]}
      </div>

      <style>{`
        @keyframes heroOrbitWin {
          0%,100% { opacity:.8; }
          50%      { transform: rotate(calc(var(--ang,0deg) + 25deg)) translateX(calc(var(--dist,60px) + 14px)) rotate(calc(-1*(var(--ang,0deg)+25deg))) scale(1.2); opacity:1; }
        }
        @keyframes heroOrbitLose {
          0%,100% { opacity:.75; }
          50%      { transform: rotate(var(--ang,0deg)) translateX(var(--dist,60px)) rotate(calc(-1*var(--ang,0deg))) scale(0.85) translateY(6px); opacity:.5; }
        }
        @keyframes heroOrbitDraw {
          0%,100% { opacity:.7; }
          50%      { transform: rotate(var(--ang,0deg)) translateX(calc(var(--dist,60px) + 8px)) rotate(calc(-1*var(--ang,0deg))) scale(1.05); opacity:.9; }
        }
        @keyframes heroCenterPop {
          0%   { transform:scale(0) rotate(-15deg); opacity:0; }
          70%  { transform:scale(1.2) rotate(5deg); opacity:1; }
          100% { transform:scale(1) rotate(0deg); opacity:1; }
        }
      `}</style>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ResultModalProps {
  verdict: 'win' | 'lose' | 'draw'
  humanCall: Call
  agentCall: Call | null
  outcome: Call
  startPrice: number
  closePrice: number
  roundId: bigint | number
  txHash?: string
  onPlayAgain: () => void
}

export function ResultModal({
  verdict,
  humanCall,
  agentCall,
  outcome,
  startPrice,
  closePrice,
  roundId,
  txHash,
  onPlayAgain,
}: ResultModalProps) {
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const msgPool = verdict === 'win' ? WIN_MSGS : verdict === 'lose' ? LOSE_MSGS : DRAW_MSGS
  const msgRef  = useRef(msgPool[Math.floor(Math.random() * msgPool.length)])

  useEffect(() => { const t = setTimeout(() => setMounted(true), 40); return () => clearTimeout(t) }, [])

  useConfetti(verdict === 'win' && mounted, canvasRef as React.RefObject<HTMLCanvasElement>)
  useRain(verdict === 'lose' && mounted, canvasRef as React.RefObject<HTMLCanvasElement>)

  const pct = startPrice > 0 ? ((closePrice - startPrice) / startPrice) * 100 : 0
  const deltaText = `${pct >= 0 ? '+' : ''}${pct.toFixed(3)}%`

  const accent = verdict === 'win' ? '#10b981'
    : verdict === 'lose' ? '#f43f5e'
    : '#fbbf24'
  const glowColor = verdict === 'win' ? 'rgba(16,185,129,0.25)'
    : verdict === 'lose' ? 'rgba(244,63,94,0.25)'
    : 'rgba(251,191,36,0.2)'
  const borderCol = verdict === 'win' ? 'rgba(16,185,129,0.45)'
    : verdict === 'lose' ? 'rgba(244,63,94,0.45)'
    : 'rgba(251,191,36,0.4)'
  const bgColor = verdict === 'win' ? 'rgba(0,15,7,0.97)'
    : verdict === 'lose' ? 'rgba(15,0,5,0.97)'
    : 'rgba(8,6,0,0.97)'
  const cardBg = verdict === 'win' ? 'linear-gradient(160deg,#010f06 0%,#021a0c 100%)'
    : verdict === 'lose' ? 'linear-gradient(160deg,#0f0105 0%,#1c0207 100%)'
    : 'linear-gradient(160deg,#0d0900 0%,#1a1000 100%)'

  const verdictLabel = verdict === 'win' ? 'YOU WON'
    : verdict === 'lose' ? 'YOU LOST'
    : "IT'S A DRAW"

  const verdictAnimation = verdict === 'win'
    ? 'resultPulseGreen 1.8s ease-in-out infinite'
    : verdict === 'lose'
    ? 'resultShake 0.5s cubic-bezier(.36,.07,.19,.97) 0.5s both'
    : 'resultPulseYellow 1.8s ease-in-out infinite'

  const ctaLabel = verdict === 'win' ? '🔁  Play Again'
    : verdict === 'lose' ? '🔄  Rematch'
    : '⚖️  Break the Tie'

  const ctaBg = verdict === 'win'
    ? 'linear-gradient(135deg,#059669,#10b981)'
    : verdict === 'lose'
    ? 'linear-gradient(135deg,#6C2BF2,#7c3af5)'
    : 'linear-gradient(135deg,#b45309,#d97706)'
  const ctaShadow = verdict === 'win'
    ? '0 0 28px rgba(16,185,129,0.45)'
    : verdict === 'lose'
    ? '0 0 28px rgba(108,43,242,0.50)'
    : '0 0 28px rgba(217,119,6,0.45)'

  // For draw: show WHY it's a draw
  const drawReason = agentCall === null
    ? 'Bot didn\'t predict this round'
    : humanCall === agentCall
    ? `Both called ${humanCall === 'up' ? '▲ Higher' : '▼ Lower'} — no one out-predicted the other`
    : ''

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: bgColor,
        backdropFilter: 'blur(10px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[340px] rounded-2xl overflow-hidden"
        style={{
          background: cardBg,
          border: `1px solid ${borderCol}`,
          boxShadow: `0 0 80px ${glowColor}, 0 0 200px ${glowColor}, 0 24px 60px rgba(0,0,0,0.8)`,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.93)',
          transition: 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
        }}>

        {/* ── Hero ── */}
        <div className="relative h-44 bg-black/20 overflow-hidden">
          <AnimatedHero verdict={verdict} />

          {/* outcome badge */}
          <div className="absolute top-3 right-3 font-mono text-[10px] font-bold uppercase tracking-[.1em] px-2.5 py-1 rounded-full z-10"
            style={{ background: `${accent}22`, border: `1px solid ${accent}55`, color: accent }}>
            ETH {outcome === 'up' ? '▲ UP' : '▼ DOWN'}
          </div>

          <div className="absolute inset-0 pointer-events-none"
            style={{ background: `linear-gradient(to bottom, transparent 40%, ${verdict === 'win' ? '#010f06' : verdict === 'lose' ? '#0f0105' : '#0d0900'} 100%)` }} />
        </div>

        {/* ── Content ── */}
        <div className="px-5 pb-5 pt-3">
          {/* Verdict */}
          <div className="text-center mb-4">
            <div className="font-display font-black text-[38px] leading-none uppercase tracking-wide"
              style={{ color: accent, textShadow: `0 0 40px ${accent}, 0 0 80px ${glowColor}`, animation: verdictAnimation }}>
              {verdictLabel}
            </div>
            <p className="font-mono text-[11px] text-white/40 italic mt-1.5 leading-snug px-4">
              {msgRef.current}
            </p>
            {verdict === 'draw' && drawReason && (
              <p className="font-mono text-[10px] text-[#fbbf24]/50 mt-1 px-4">
                {drawReason}
              </p>
            )}
          </div>

          {/* Score card */}
          <div className="rounded-xl p-3.5 mb-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* You vs Axiom-7 */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 text-center">
                <div className="font-mono text-[9px] text-white/30 uppercase tracking-[.1em] mb-0.5">You</div>
                <div className="font-display font-black text-[17px]"
                  style={{ color: humanCall === 'up' ? '#10b981' : '#f43f5e' }}>
                  {humanCall === 'up' ? '▲' : '▼'} {humanCall === 'up' ? 'Higher' : 'Lower'}
                </div>
                {verdict === 'win' && (
                  <div className="font-mono text-[9px] text-[#10b981] mt-0.5">✓ Correct</div>
                )}
                {verdict === 'draw' && humanCall === outcome && (
                  <div className="font-mono text-[9px] text-[#fbbf24] mt-0.5">✓ Correct</div>
                )}
              </div>

              <div className="font-mono text-[10px] text-white/20 font-bold">VS</div>

              <div className="flex-1 text-center">
                <div className="font-mono text-[9px] text-white/30 uppercase tracking-[.1em] mb-0.5">Axiom-7</div>
                {agentCall ? (
                  <>
                    <div className="font-display font-black text-[17px]"
                      style={{ color: agentCall === 'up' ? '#10b981' : '#f43f5e' }}>
                      {agentCall === 'up' ? '▲' : '▼'} {agentCall === 'up' ? 'Higher' : 'Lower'}
                    </div>
                    {verdict === 'lose' && (
                      <div className="font-mono text-[9px] text-[#10b981] mt-0.5">✓ Correct</div>
                    )}
                    {verdict === 'draw' && agentCall === outcome && (
                      <div className="font-mono text-[9px] text-[#fbbf24] mt-0.5">✓ Correct</div>
                    )}
                  </>
                ) : (
                  <div className="font-mono text-[11px] text-white/25 italic">No call</div>
                )}
              </div>
            </div>

            {/* Price row */}
            <div className="flex items-center justify-between rounded-lg px-3 py-2"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              <div className="text-center">
                <div className="font-mono text-[9px] text-white/25 mb-0.5">OPEN</div>
                <div className="font-mono text-[12px] text-white font-semibold tabular-nums">
                  ${startPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[13px] font-bold"
                  style={{ color: pct >= 0 ? '#10b981' : '#f43f5e' }}>
                  {deltaText}
                </div>
                <div className="font-mono text-[9px] text-white/25">move</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-[9px] text-white/25 mb-0.5">CLOSE</div>
                <div className="font-mono text-[12px] text-white font-semibold tabular-nums">
                  ${closePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button onClick={onPlayAgain}
            className="w-full py-3.5 rounded-xl font-mono font-bold text-[13px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97] hover:brightness-110"
            style={{ background: ctaBg, boxShadow: ctaShadow }}>
            {ctaLabel}
          </button>

          {txHash && (
            <a href={`https://sepolia.mantlescan.xyz/tx/${txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-white/20 hover:text-white/45 uppercase tracking-[.08em] mt-3 transition-colors">
              ▦ Round #{Number(roundId)} on Mantle ↗
            </a>
          )}
        </div>
      </div>

      <style>{`
        @keyframes resultPulseGreen {
          0%,100% { text-shadow: 0 0 40px #10b981, 0 0 80px rgba(16,185,129,0.25); }
          50%      { text-shadow: 0 0 60px #10b981, 0 0 120px rgba(16,185,129,0.45), 0 0 200px rgba(16,185,129,0.15); }
        }
        @keyframes resultPulseYellow {
          0%,100% { text-shadow: 0 0 40px #fbbf24, 0 0 80px rgba(251,191,36,0.2); }
          50%      { text-shadow: 0 0 60px #fbbf24, 0 0 120px rgba(251,191,36,0.35), 0 0 200px rgba(251,191,36,0.1); }
        }
        @keyframes resultShake {
          0%,100% { transform:translateX(0); }
          15% { transform:translateX(-7px) rotate(-2deg); }
          30% { transform:translateX(6px) rotate(2deg); }
          45% { transform:translateX(-5px) rotate(-1deg); }
          60% { transform:translateX(4px) rotate(1deg); }
          75% { transform:translateX(-2px); }
        }
      `}</style>
    </div>
  )
}
