'use client'

import type { RoundResult } from '@/lib/store/roundStore'
import { formatPrice } from '@/lib/mock/priceSimulator'

interface ResultCardProps {
  result: RoundResult
  agentName: string
  agentInitials: string
  onPlayAgain: () => void
}

export function ResultCard({ result, agentName, agentInitials, onPlayAgain }: ResultCardProps) {
  const { humanWon, agentWon, humanCall, agentCall, outcome, deltaText, points, newStreak, asset, startPrice, closePrice } = result

  const shareText = humanWon
    ? `I just out-predicted ${agentName} on Klyro! Called ${humanCall.toUpperCase()} — price moved ${deltaText}. ${newStreak > 1 ? `${newStreak} in a row 🔥` : ''} Can you beat the machine? #Klyro #MantleAI`
    : `${agentName} got me on Klyro — I called ${humanCall.toUpperCase()} but price went ${outcome.toUpperCase()} ${deltaText}. Rematch time. #Klyro #MantleAI`

  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`

  return (
    <div className="w-full max-w-[400px] mx-auto">
      {/* outcome banner */}
      <div className={`rounded-t-xl px-5 py-4 text-center text-white ${humanWon ? 'bg-up' : result.humanCall === null ? 'bg-ink-2' : 'bg-down'}`}>
        <div className="font-display font-black text-[28px] uppercase tracking-[-0.03em]">
          {result.humanCall === null
            ? 'No call made'
            : humanWon
            ? 'You won!'
            : 'You lost'}
        </div>
        <div className="font-mono text-[12px] tracking-[.12em] uppercase opacity-85 mt-1">
          {humanWon && points > 0 ? `+${points} pts${newStreak >= 3 ? ` · ${newStreak}× streak bonus` : ''}` : 'No points'}
        </div>
      </div>

      <div className="bg-surface border border-t-0 border-line rounded-b-xl overflow-hidden shadow-lg">
        {/* price delta */}
        <div className="px-5 py-4 border-b border-line flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] tracking-[.14em] uppercase text-ink-3 mb-1">{asset}</div>
            <div className="font-mono font-bold text-[16px]">
              {formatPrice(asset, startPrice)} → {formatPrice(asset, closePrice)}
            </div>
          </div>
          <div className={`font-mono font-bold text-[20px] ${outcome === 'up' ? 'text-up' : 'text-down'}`}>
            {outcome === 'up' ? '▲' : '▼'} {deltaText}
          </div>
        </div>

        {/* versus row */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 border-b border-line">
          {/* Human */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className={`w-10 h-10 rounded-[11px] grid place-items-center font-display font-black text-[14px] text-white ${humanWon ? 'bg-up' : 'bg-ink'}`}>
              YOU
            </div>
            <div className="font-mono text-[9px] tracking-[.1em] uppercase text-ink-3">Human</div>
            {result.humanCall ? (
              <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${humanCall === 'up' ? 'text-up' : 'text-down'}`}>
                {humanCall === 'up' ? '▲' : '▼'} {humanCall.toUpperCase()}
              </div>
            ) : (
              <div className="font-mono text-[10px] text-ink-3">No call</div>
            )}
            {result.humanCall !== null && (
              <div className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full ${humanWon ? 'bg-up-wash text-up-ink' : 'bg-down-wash text-down-ink'}`}>
                {humanWon ? 'WIN' : 'LOSS'}
              </div>
            )}
          </div>

          <div className="w-9 h-9 rounded-full bg-surface border-2 border-ink grid place-items-center font-display font-black text-[13px]">
            VS
          </div>

          {/* Agent */}
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className={`w-10 h-10 rounded-[11px] grid place-items-center font-display font-black text-[14px] text-white`}
              style={{ background: agentWon ? 'var(--up)' : 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
              {agentInitials}
            </div>
            <div className="font-mono text-[9px] tracking-[.1em] uppercase text-sig">{agentName}</div>
            <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${agentCall === 'up' ? 'text-up' : 'text-down'}`}>
              {agentCall === 'up' ? '▲' : '▼'} {agentCall.toUpperCase()}
            </div>
            <div className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full ${agentWon ? 'bg-up-wash text-up-ink' : 'bg-down-wash text-down-ink'}`}>
              {agentWon ? 'WIN' : 'LOSS'}
            </div>
          </div>
        </div>

        {/* mock on-chain proof */}
        <div className="px-5 py-3 border-b border-line font-mono text-[11px] flex items-center justify-between">
          <span className="text-ink-3 uppercase tracking-[.1em]">Round #{result.roundId}</span>
          <span className="text-sig-ink bg-sig-wash px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-[.06em]">
            ▦ Settled on-chain (mock)
          </span>
        </div>

        {/* actions */}
        <div className="px-5 py-4 flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-sig text-white py-3 rounded-full shadow-sig transition-transform active:translate-y-px"
          >
            Play again →
          </button>
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-surface text-ink border border-line-2 py-3 rounded-full text-center transition-transform active:translate-y-px"
          >
            Share to X
          </a>
        </div>
      </div>
    </div>
  )
}
