'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { prepareContractCall, getContract, defineChain } from 'thirdweb'
import { thirdwebClient } from '@/lib/contracts/thirdweb-client'
import { mantleSepolia } from '@/lib/contracts/chain'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { BATTLE_RESULT_NFT_ABI } from '@/lib/contracts/abis'
import { createPublicClient, http } from 'viem'
import type { Call } from '@/lib/store/roundStore'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

// ── Strategy type + badge classifier ────────────────────────────────────────
// Based on whether you agreed/disagreed with the AI and whether you were right.

export interface BattleAnalysis {
  strategyType: string
  strategyDesc: string
  badge: string
  badgeIcon: string
}

export function classifyBattle(
  humanCall: Call,
  agentCall: Call | null,
  outcome: Call,
  verdict: 'win' | 'lose' | 'draw'
): BattleAnalysis {
  const humanRight = humanCall === outcome
  const agentRight = agentCall !== null && agentCall === outcome
  const agreedWithBot = agentCall !== null && humanCall === agentCall

  if (verdict === 'win') {
    // Won while disagreeing with the AI
    if (!agreedWithBot) {
      return humanCall === 'up'
        ? { strategyType: 'Momentum Alpha',   strategyDesc: 'Rode the bull — and left the AI behind',   badge: 'AI Slayer',     badgeIcon: '🗡️' }
        : { strategyType: 'Contrarian Alpha',  strategyDesc: 'Bet against the trend — and nailed it',     badge: 'AI Slayer',     badgeIcon: '🗡️' }
    }
    // Won and agreed with the AI (both right — draw should've fired but edge case)
    return { strategyType: 'Sharp Consensus', strategyDesc: 'Synced with the machine and both won',       badge: 'Market Oracle', badgeIcon: '🔮' }
  }

  if (verdict === 'lose') {
    if (humanCall === 'up') {
      return { strategyType: 'Bull Conviction', strategyDesc: 'Held the bull thesis — the market disagreed', badge: 'Level Up',    badgeIcon: '⬆️' }
    }
    return { strategyType: 'Bear Conviction',   strategyDesc: 'Took the short side — timing was off',        badge: 'Level Up',    badgeIcon: '⬆️' }
  }

  // Draw
  if (humanRight && agentRight) {
    return { strategyType: 'Parallel Intelligence', strategyDesc: 'Both read the market perfectly — no edge separated you', badge: 'Mind Sync',   badgeIcon: '🧠' }
  }
  if (!humanRight && !agentRight) {
    return { strategyType: 'Volatile Market',  strategyDesc: 'Market surprised both of you — chaos round',  badge: 'Chaos Pair',  badgeIcon: '⚡' }
  }
  return { strategyType: 'Neutral Ground',     strategyDesc: 'No edge either way',                           badge: 'Balanced',    badgeIcon: '⚖️' }
}

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
          50%      { opacity:1; }
        }
        @keyframes heroOrbitLose {
          0%,100% { opacity:.75; }
          50%      { opacity:.5; }
        }
        @keyframes heroOrbitDraw {
          0%,100% { opacity:.7; }
          50%      { opacity:.9; }
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

// ── Mint Battle NFT hook ──────────────────────────────────────────────────────

type MintState = 'idle' | 'checking' | 'minting' | 'done' | 'error'

function useMintBattle(
  playerAddress: string | undefined,
  roundId: bigint | number,
  humanCall: Call,
  outcome: Call,
  verdict: 'win' | 'lose' | 'draw'
) {
  const [mintState, setMintState] = useState<MintState>('idle')
  const [alreadyMinted, setAlreadyMinted] = useState(false)
  const [mintedTokenId, setMintedTokenId] = useState<number | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)
  const { mutateAsync: sendTx } = useSendTransaction()

  // Check if already minted on load
  useEffect(() => {
    if (!playerAddress) return
    const viemClient = createPublicClient({
      chain: { id: mantleSepolia.id, name: mantleSepolia.name, nativeCurrency: mantleSepolia.nativeCurrency,
        rpcUrls: { default: { http: [mantleSepolia.rpcUrls.default.http[0]] } } } as any,
      transport: http(),
    })
    setMintState('checking')
    viemClient.readContract({
      address: CONTRACTS.BattleResultNFT as `0x${string}`,
      abi: BATTLE_RESULT_NFT_ABI,
      functionName: 'hasMinted',
      args: [playerAddress as `0x${string}`, BigInt(roundId)],
    }).then(has => {
      setAlreadyMinted(!!has)
      setMintState('idle')
    }).catch(() => setMintState('idle'))
  }, [playerAddress, roundId])

  const mint = useCallback(async () => {
    if (!playerAddress) return
    setMintState('minting')
    setMintError(null)
    try {
      const verdictNum = verdict === 'win' ? 0 : verdict === 'lose' ? 1 : 2
      const contract = getContract({
        client: thirdwebClient,
        chain: twChain,
        address: CONTRACTS.BattleResultNFT as `0x${string}`,
        abi: BATTLE_RESULT_NFT_ABI as any,
      })
      const tx = prepareContractCall({
        contract,
        method: 'function mintBattle(address player, uint256 roundId, bool humanCall, bool outcome, uint8 verdict) returns (uint256 tokenId)',
        params: [
          playerAddress as `0x${string}`,
          BigInt(roundId),
          humanCall === 'up',
          outcome === 'up',
          verdictNum,
        ],
      })
      const receipt = await sendTx(tx as any)
      // Try to extract tokenId from logs (Transfer event topic[3])
      try {
        const transferLog = (receipt as any).logs?.find(
          (l: any) => l.topics?.[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
        )
        if (transferLog?.topics?.[3]) {
          setMintedTokenId(parseInt(transferLog.topics[3], 16))
        }
      } catch { /* token ID is optional */ }
      setAlreadyMinted(true)
      setMintState('done')
    } catch (e: unknown) {
      const msg = (e as Error).message ?? 'Mint failed'
      if (msg.includes('AlreadyMinted')) {
        setAlreadyMinted(true)
        setMintState('done')
      } else {
        setMintError(msg.slice(0, 80))
        setMintState('error')
      }
    }
  }, [playerAddress, roundId, humanCall, outcome, verdict, sendTx])

  return { mintState, alreadyMinted, mintedTokenId, mintError, mint }
}

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
  const account = useActiveAccount()

  const msgPool = verdict === 'win' ? WIN_MSGS : verdict === 'lose' ? LOSE_MSGS : DRAW_MSGS
  const msgRef  = useRef(msgPool[Math.floor(Math.random() * msgPool.length)])

  const analysis = classifyBattle(humanCall, agentCall, outcome, verdict)

  const { mintState, alreadyMinted, mintedTokenId, mintError, mint } = useMintBattle(
    account?.address, roundId, humanCall, outcome, verdict
  )

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

  // Draw reason
  const drawReason = agentCall === null
    ? 'Bot didn\'t predict this round'
    : humanCall === agentCall
    ? `Both called ${humanCall === 'up' ? '▲ Higher' : '▼ Lower'} — no one out-predicted the other`
    : ''

  // Share to X
  const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://klyro.xyz'
  const roundUrl = `${BASE_URL}/round/${roundId}`
  const shareText = verdict === 'win'
    ? `I just out-predicted Axiom-7 AI on @KlyroHQ! Called ${humanCall === 'up' ? '▲ HIGHER' : '▼ LOWER'} — ETH moved ${deltaText}. Strategy: ${analysis.strategyType}. Badge: ${analysis.badgeIcon} ${analysis.badge}. Can you beat the machine? #Klyro #Mantle #HumanVsAI`
    : verdict === 'lose'
    ? `Axiom-7 AI got me on @KlyroHQ — I called ${humanCall === 'up' ? '▲ HIGHER' : '▼ LOWER'} but ETH went ${outcome === 'up' ? '▲' : '▼'} ${deltaText}. Rematch time. #Klyro #Mantle #HumanVsAI`
    : `Drew with Axiom-7 AI on @KlyroHQ — ${analysis.strategyType}! ETH moved ${deltaText}. #Klyro #Mantle #HumanVsAI`
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText + '\n' + roundUrl)}`

  // Mint button label
  const mintLabel = mintState === 'checking' ? 'Checking…'
    : mintState === 'minting' ? 'Minting…'
    : mintState === 'done' || alreadyMinted ? `✓ Minted${mintedTokenId !== null ? ` #${mintedTokenId}` : ''}`
    : mintState === 'error' ? 'Retry Mint'
    : 'Mint Battle NFT'

  const EXPLORER = 'https://explorer.sepolia.mantle.xyz'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: bgColor,
        backdropFilter: 'blur(10px)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease',
        overflowY: 'auto',
      }}>
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }} />

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-[360px] rounded-2xl overflow-hidden my-4"
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
          <div className="text-center mb-3">
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

          {/* ── Strategy + Badge row ── */}
          <div className="flex items-center gap-2 mb-4 rounded-xl p-3"
            style={{ background: `${accent}0d`, border: `1px solid ${accent}22` }}>
            {/* Strategy type */}
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[9px] tracking-[.14em] uppercase text-white/30 mb-0.5">Strategy Type</div>
              <div className="font-mono font-bold text-[13px] truncate" style={{ color: accent }}>
                {analysis.strategyType}
              </div>
              <div className="font-mono text-[10px] text-white/30 leading-tight mt-0.5 truncate">
                {analysis.strategyDesc}
              </div>
            </div>
            {/* Badge */}
            <div className="flex flex-col items-center shrink-0 gap-0.5">
              <div className="text-[28px] leading-none">{analysis.badgeIcon}</div>
              <div className="font-mono text-[9px] text-white/50 tracking-[.08em] uppercase">{analysis.badge}</div>
            </div>
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

          {/* ── Action row: Mint + Share ── */}
          {account && (
            <div className="flex gap-2 mb-3">
              {/* Mint Battle NFT */}
              <button
                onClick={mintState === 'idle' || mintState === 'error' ? mint : undefined}
                disabled={mintState === 'checking' || mintState === 'minting' || mintState === 'done' || alreadyMinted}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-mono text-[11px] font-bold uppercase tracking-[.06em] text-white transition-all disabled:opacity-60"
                style={{
                  background: mintState === 'done' || alreadyMinted
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(108,43,242,0.25)',
                  border: mintState === 'done' || alreadyMinted
                    ? '1px solid rgba(16,185,129,0.4)'
                    : '1px solid rgba(108,43,242,0.4)',
                  color: mintState === 'done' || alreadyMinted ? '#10b981' : '#9A6BFF',
                }}>
                {mintState === 'minting'
                  ? <><span className="w-3 h-3 rounded-full border border-[#9A6BFF] border-t-transparent animate-spin" /> Minting…</>
                  : <>{mintState === 'done' || alreadyMinted ? '✓' : '⬡'} {mintLabel}</>
                }
              </button>

              {/* Share to X */}
              <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-mono text-[11px] font-bold uppercase tracking-[.06em] transition-opacity hover:opacity-80"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}>
                <svg width="13" height="13" viewBox="0 0 1200 1227" fill="currentColor">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"/>
                </svg>
                Share
              </a>
            </div>
          )}

          {mintError && (
            <p className="font-mono text-[10px] text-[#f43f5e] mb-2 text-center">{mintError}</p>
          )}

          {/* Mint success: view on explorer */}
          {(mintState === 'done' || alreadyMinted) && mintedTokenId !== null && (
            <a href={`${EXPLORER}/token/${CONTRACTS.BattleResultNFT}?a=${account?.address}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 font-mono text-[10px] text-[#9A6BFF]/60 hover:text-[#9A6BFF] uppercase tracking-[.08em] mb-3 transition-colors">
              View NFT on Mantle Explorer ↗
            </a>
          )}

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
