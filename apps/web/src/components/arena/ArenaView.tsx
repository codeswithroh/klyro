'use client'

import { useRoundStore, type Call } from '@/lib/store/roundStore'
import { useRoundTimer } from '@/lib/hooks/useRoundTimer'
import { useIdlePriceTick } from '@/lib/hooks/useIdlePriceTick'
import { CountdownRing } from './CountdownRing'
import { ResultCard } from './ResultCard'
import { PriceSparkline } from './PriceSparkline'
import type { AssetPair } from '@/lib/mock/priceSimulator'
import Link from 'next/link'

const ASSETS: AssetPair[] = ['ETH/USD', 'BTC/USD', 'MNT/USD']
const ROUND_DURATION = 60 // seconds

export function ArenaView() {
  // Hooks that drive ticks
  useRoundTimer()
  useIdlePriceTick()

  const phase         = useRoundStore((s) => s.phase)
  const asset         = useRoundStore((s) => s.asset)
  const formattedPrice= useRoundStore((s) => s.formattedPrice)
  const deltaText     = useRoundStore((s) => s.deltaText)
  const deltaIsUp     = useRoundStore((s) => s.deltaIsUp)
  const priceHistory  = useRoundStore((s) => s.priceHistory)
  const secondsLeft   = useRoundStore((s) => s.secondsLeft)
  const totalSeconds  = useRoundStore((s) => s.totalSeconds)
  const humanCall     = useRoundStore((s) => s.humanCall)
  const agentCall     = useRoundStore((s) => s.agentCall)
  const agentThinking = useRoundStore((s) => s.agentThinking)
  const agent         = useRoundStore((s) => s.agent)
  const lastResult    = useRoundStore((s) => s.lastResult)
  const roundId       = useRoundStore((s) => s.roundId)

  const startRound    = useRoundStore((s) => s.startRound)
  const makeCall      = useRoundStore((s) => s.makeCall)
  const resetToIdle   = useRoundStore((s) => s.resetToIdle)
  const setAsset      = useRoundStore((s) => s.setAsset)

  function handleCall(call: Call) {
    if (humanCall !== null || phase !== 'open') return
    makeCall(call)
  }

  function handleStartRound() {
    startRound(asset, ROUND_DURATION)
  }

  function handlePlayAgain() {
    resetToIdle()
  }

  // ── RESOLVED — show result card ────────────────────────────────────────
  if (phase === 'resolved' && lastResult) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-12">
        <ResultCard
          result={lastResult}
          agentName={agent?.name ?? 'Axiom-7'}
          agentInitials={agent?.initials ?? 'AX'}
          onPlayAgain={handlePlayAgain}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-[400px]">

        {/* asset picker */}
        <div className="flex gap-2 justify-center mb-5">
          {ASSETS.map((a) => (
            <button
              key={a}
              onClick={() => { if (phase === 'idle') setAsset(a) }}
              disabled={phase !== 'idle'}
              className={`font-mono text-[11px] font-semibold tracking-[.1em] uppercase px-3 py-1.5 rounded-full border transition-colors ${a === asset ? 'bg-sig-wash text-sig-ink border-transparent' : 'bg-surface border-line-2 text-ink-2 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed'}`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* round header */}
        <div className="flex items-center justify-between mb-3 font-mono text-[11px] text-ink-3">
          <span>
            {phase === 'open' && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-up mr-2 animate-pulse"
                style={{ boxShadow: '0 0 0 3px var(--up-wash)' }} />
            )}
            {phase === 'open' ? `LIVE ROUND · #${roundId}` : 'ARENA'}
          </span>
          {phase === 'open' && (
            <Link href={`/round/${roundId}`} className="underline text-sig hover:text-sig-ink">
              Verify on-chain ▦
            </Link>
          )}
        </div>

        {/* main card */}
        <div className="bg-surface rounded-xl border border-line shadow-lg overflow-hidden">
          <div className="px-5 py-5">

            {/* asset + price row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full grid place-items-center text-white font-display font-bold text-[14px]"
                  style={{ background: 'conic-gradient(from 200deg, var(--sig), var(--sig-2))' }}>
                  {asset === 'ETH/USD' ? 'Ξ' : asset === 'BTC/USD' ? '₿' : 'M'}
                </div>
                <div>
                  <div className="font-display font-bold text-[15px]">{asset}</div>
                  <div className="font-mono text-[10px] text-ink-3">Pyth oracle · Mantle Sepolia</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-[17px]">{formattedPrice}</div>
                {phase === 'open' && (
                  <div className={`font-mono text-[11px] font-semibold ${deltaIsUp ? 'text-up' : 'text-down'}`}>
                    {deltaIsUp ? '▲' : '▼'} {deltaText}
                  </div>
                )}
              </div>
            </div>

            {/* sparkline (only during open round) */}
            {phase === 'open' && priceHistory.length > 2 && (
              <div className="mb-3 flex justify-center opacity-70">
                <PriceSparkline history={priceHistory} isUp={deltaIsUp} width={340} height={36} />
              </div>
            )}

            {/* countdown or start button */}
            {phase === 'open' ? (
              <div className="flex flex-col items-center gap-2 my-3">
                <CountdownRing seconds={secondsLeft} total={totalSeconds} size={120} />
                <p className="font-mono text-[10px] text-ink-3 uppercase tracking-[.2em]">
                  Window closes — lock your call
                </p>
              </div>
            ) : (
              <div className="my-6 flex justify-center">
                <button
                  onClick={handleStartRound}
                  className="font-mono font-semibold text-[14px] tracking-[.04em] uppercase bg-sig text-white px-8 py-3.5 rounded-full shadow-sig transition-transform active:translate-y-px"
                >
                  Start round →
                </button>
              </div>
            )}

            {/* versus row (only during open round) */}
            {phase === 'open' && (
              <>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 mb-5">
                  {/* Human */}
                  <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                    <div className={`w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[13px] ${humanCall ? (humanCall === 'up' ? 'bg-up' : 'bg-down') : 'bg-ink'}`}>
                      YOU
                    </div>
                    <div className="font-mono text-[9px] tracking-[.12em] uppercase text-ink-3">Human</div>
                    {humanCall ? (
                      <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${humanCall === 'up' ? 'text-up' : 'text-down'}`}>
                        {humanCall === 'up' ? '▲ UP' : '▼ DOWN'}
                      </div>
                    ) : (
                      <div className="font-mono text-[9px] text-ink-3">—</div>
                    )}
                  </div>

                  <div className="w-9 h-9 rounded-full bg-surface border-2 border-ink grid place-items-center font-display font-black text-[13px]">
                    VS
                  </div>

                  {/* Agent */}
                  <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                    <div className="w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[13px]"
                      style={{ background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
                      {agent?.initials ?? 'AX'}
                    </div>
                    <div className="font-mono text-[9px] tracking-[.12em] uppercase text-sig">
                      {agent?.name ?? 'Axiom-7'}
                    </div>
                    {agentThinking ? (
                      <div className="font-mono text-[9px] text-ink-3 animate-pulse">Thinking…</div>
                    ) : agentCall ? (
                      <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${agentCall === 'up' ? 'text-up' : 'text-down'}`}>
                        {agentCall === 'up' ? '▲ UP' : '▼ DOWN'}
                      </div>
                    ) : (
                      <div className="font-mono text-[9px] text-ink-3">Waiting…</div>
                    )}
                  </div>
                </div>

                {/* call buttons */}
                {humanCall === null ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleCall('up')}
                      className="call-btn bg-up text-white rounded-[14px] flex flex-col items-center py-5 font-display font-bold text-[20px] uppercase tracking-[-0.01em] gap-1 transition-transform active:scale-[.97] hover:brightness-105"
                    >
                      <span className="text-[24px] leading-none">▲</span>
                      UP
                      <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price rises</small>
                    </button>
                    <button
                      onClick={() => handleCall('down')}
                      className="call-btn bg-down text-white rounded-[14px] flex flex-col items-center py-5 font-display font-bold text-[20px] uppercase tracking-[-0.01em] gap-1 transition-transform active:scale-[.97] hover:brightness-105"
                    >
                      <span className="text-[24px] leading-none">▼</span>
                      DOWN
                      <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price falls</small>
                    </button>
                  </div>
                ) : (
                  <div className={`rounded-[14px] py-4 text-center font-display font-bold text-[18px] uppercase tracking-[-0.01em] text-white ${humanCall === 'up' ? 'bg-up' : 'bg-down'}`}>
                    {humanCall === 'up' ? '▲ UP locked' : '▼ DOWN locked'}
                    <div className="font-mono text-[10px] font-normal tracking-[.1em] mt-1 opacity-85">
                      Committed on-chain (mock)
                    </div>
                  </div>
                )}
              </>
            )}

            {/* idle hint */}
            {phase === 'idle' && (
              <p className="text-center font-mono text-[11px] text-ink-3 tracking-[.06em] uppercase mt-2">
                Pick an asset above, then start a round
              </p>
            )}
          </div>
        </div>

        {/* agent strategy hint */}
        {phase === 'open' && agent && (
          <p className="mt-3 text-center font-mono text-[10px] text-ink-3">
            {agent.name} · <span className="italic">{agent.strategy}</span>
          </p>
        )}
      </div>
    </div>
  )
}
