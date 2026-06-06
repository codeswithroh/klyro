'use client'

import { useState, useEffect } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { usePythPrice } from '@/lib/hooks/usePythPrice'
import { useLockPrediction, useActiveRound } from '@/lib/hooks/useRound'
import { useRoundStore, type Call } from '@/lib/store/roundStore'
import { useRoundTimer } from '@/lib/hooks/useRoundTimer'
import { useIdlePriceTick } from '@/lib/hooks/useIdlePriceTick'
import { CONTRACTS } from '@/lib/contracts/addresses'
import { CountdownRing } from './CountdownRing'
import { ResultCard } from './ResultCard'
import { PriceSparkline } from './PriceSparkline'
import { formatPrice, type AssetPair } from '@/lib/mock/priceSimulator'
import Link from 'next/link'
import { WalletButton } from '@/components/ui/WalletButton'

const ASSETS: AssetPair[] = ['ETH/USD', 'BTC/USD', 'MNT/USD']
const ROUND_DURATION = 60

// Contracts are deployed when address is non-zero
const CONTRACTS_LIVE = CONTRACTS.RoundManager !== '0x0000000000000000000000000000000000000000'

export function ArenaView() {
  const account = useActiveAccount()
  const isConnected = !!account

  // Zustand mock layer (drives countdown UI + local state when contracts not yet live)
  useRoundTimer()
  useIdlePriceTick()

  const phase         = useRoundStore((s) => s.phase)
  const asset         = useRoundStore((s) => s.asset)
  const secondsLeft   = useRoundStore((s) => s.secondsLeft)
  const totalSeconds  = useRoundStore((s) => s.totalSeconds)
  const humanCall     = useRoundStore((s) => s.humanCall)
  const agentCall     = useRoundStore((s) => s.agentCall)
  const agentThinking = useRoundStore((s) => s.agentThinking)
  const agent         = useRoundStore((s) => s.agent)
  const lastResult    = useRoundStore((s) => s.lastResult)
  const roundId       = useRoundStore((s) => s.roundId)
  const priceHistory  = useRoundStore((s) => s.priceHistory)
  const deltaText     = useRoundStore((s) => s.deltaText)
  const deltaIsUp     = useRoundStore((s) => s.deltaIsUp)
  const storeFormattedPrice = useRoundStore((s) => s.formattedPrice)
  const startRound    = useRoundStore((s) => s.startRound)
  const makeCall      = useRoundStore((s) => s.makeCall)
  const resetToIdle   = useRoundStore((s) => s.resetToIdle)
  const setAsset      = useRoundStore((s) => s.setAsset)

  // Live Pyth price (always fetched — shown whether or not a round is open)
  const { data: pythData } = usePythPrice(asset)
  const livePrice = pythData?.price ?? null

  // On-chain lock prediction
  const { lockPrediction, isPending: isTxPending, isConfirming, isConfirmed, txHash, error: txError } = useLockPrediction()

  // Chain round ID (tracked separately from mock round ID)
  const [chainRoundId, setChainRoundId] = useState<bigint | null>(null)
  // chainRound is used in Phase B to cross-reference on-chain resolution state
  useActiveRound(chainRoundId)

  // tx status message
  const [txStatus, setTxStatus] = useState<string | null>(null)

  useEffect(() => {
    if (isTxPending) setTxStatus('Sending transaction…')
    else if (isConfirming) setTxStatus('Confirming on-chain…')
    else if (isConfirmed && txHash) setTxStatus(null)
    else if (txError) setTxStatus(`Transaction failed: ${(txError as Error).message?.slice(0, 60)}`)
  }, [isTxPending, isConfirming, isConfirmed, txHash, txError])

  async function handleCall(call: Call) {
    if (humanCall !== null || phase !== 'open') return

    // Update local UI immediately
    makeCall(call)

    // If contracts are live and user is connected, also submit on-chain
    if (CONTRACTS_LIVE && isConnected && chainRoundId !== null) {
      try {
        await lockPrediction(chainRoundId, call === 'up')
      } catch (e) {
        console.error('lockPrediction failed:', e)
      }
    }
  }

  function handleStartRound() {
    startRound(asset, ROUND_DURATION)
    // chainRoundId will be set by the RoundOpened event listener in the bot service
    // For now, keep the mock round running
  }

  const displayPrice = CONTRACTS_LIVE && livePrice !== null
    ? formatPrice(asset, livePrice)
    : storeFormattedPrice

  // ── RESOLVED ────────────────────────────────────────────────────────────────
  if (phase === 'resolved' && lastResult) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-12">
        <ResultCard
          result={lastResult}
          agentName={agent?.name ?? 'Axiom-7'}
          agentInitials={agent?.initials ?? 'AX'}
          txHash={txHash ?? undefined}
          onPlayAgain={resetToIdle}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-[400px]">

        {/* wallet gate */}
        {!isConnected && (
          <div className="mb-5 bg-sig-wash border border-transparent rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[.06em] uppercase text-sig-ink">
              Connect wallet to play on-chain
            </p>
            <WalletButton />
          </div>
        )}

        {/* asset picker */}
        <div className="flex gap-2 justify-center mb-5">
          {ASSETS.map((a) => (
            <button key={a}
              onClick={() => { if (phase === 'idle') setAsset(a) }}
              disabled={phase !== 'idle'}
              className={`font-mono text-[11px] font-semibold tracking-[.1em] uppercase px-3 py-1.5 rounded-full border transition-colors ${a === asset ? 'bg-sig-wash text-sig-ink border-transparent' : 'bg-surface border-line-2 text-ink-2 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed'}`}>
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

            {/* asset + price */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full grid place-items-center text-white font-display font-bold text-[14px]"
                  style={{ background: 'conic-gradient(from 200deg, var(--sig), var(--sig-2))' }}>
                  {asset === 'ETH/USD' ? 'Ξ' : asset === 'BTC/USD' ? '₿' : 'M'}
                </div>
                <div>
                  <div className="font-display font-bold text-[15px]">{asset}</div>
                  <div className="font-mono text-[10px] text-ink-3">
                    {CONTRACTS_LIVE ? 'Pyth oracle · Mantle Sepolia' : 'Pyth oracle · mock'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-[17px]">{displayPrice}</div>
                {phase === 'open' && (
                  <div className={`font-mono text-[11px] font-semibold ${deltaIsUp ? 'text-up' : 'text-down'}`}>
                    {deltaIsUp ? '▲' : '▼'} {deltaText}
                  </div>
                )}
              </div>
            </div>

            {/* sparkline */}
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
                <button onClick={handleStartRound}
                  className="font-mono font-semibold text-[14px] tracking-[.04em] uppercase bg-sig text-white px-8 py-3.5 rounded-full shadow-sig transition-transform active:translate-y-px">
                  Start round →
                </button>
              </div>
            )}

            {/* tx status toast */}
            {txStatus && (
              <div className="mb-3 px-3 py-2 bg-sig-wash rounded text-center font-mono text-[10px] tracking-[.08em] uppercase text-sig-ink animate-pulse">
                {txStatus}
              </div>
            )}

            {/* versus + call buttons */}
            {phase === 'open' && (
              <>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 mb-5">
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

                  <div className="w-9 h-9 rounded-full bg-surface border-2 border-ink grid place-items-center font-display font-black text-[13px]">VS</div>

                  <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                    <div className="w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[13px]"
                      style={{ background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
                      {agent?.initials ?? 'AX'}
                    </div>
                    <div className="font-mono text-[9px] tracking-[.12em] uppercase text-sig">{agent?.name ?? 'Axiom-7'}</div>
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

                {humanCall === null ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleCall('up')}
                      className="call-btn bg-up text-white rounded-[14px] flex flex-col items-center py-5 font-display font-bold text-[20px] uppercase tracking-[-0.01em] gap-1 transition-transform active:scale-[.97] hover:brightness-105">
                      <span className="text-[24px] leading-none">▲</span>
                      UP
                      <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price rises</small>
                    </button>
                    <button onClick={() => handleCall('down')}
                      className="call-btn bg-down text-white rounded-[14px] flex flex-col items-center py-5 font-display font-bold text-[20px] uppercase tracking-[-0.01em] gap-1 transition-transform active:scale-[.97] hover:brightness-105">
                      <span className="text-[24px] leading-none">▼</span>
                      DOWN
                      <small className="font-mono text-[10px] font-medium tracking-[.1em] opacity-85">price falls</small>
                    </button>
                  </div>
                ) : (
                  <div className={`rounded-[14px] py-4 text-center font-display font-bold text-[18px] uppercase tracking-[-0.01em] text-white ${humanCall === 'up' ? 'bg-up' : 'bg-down'}`}>
                    {humanCall === 'up' ? '▲ UP locked' : '▼ DOWN locked'}
                    <div className="font-mono text-[10px] font-normal tracking-[.1em] mt-1 opacity-85">
                      {isConfirmed ? '✓ Confirmed on-chain' : isTxPending || isConfirming ? 'Submitting…' : CONTRACTS_LIVE && isConnected ? 'Committed on-chain' : 'Mock mode'}
                    </div>
                  </div>
                )}
              </>
            )}

            {phase === 'idle' && (
              <p className="text-center font-mono text-[11px] text-ink-3 tracking-[.06em] uppercase mt-2">
                Pick an asset above, then start a round
              </p>
            )}
          </div>
        </div>

        {phase === 'open' && agent && (
          <p className="mt-3 text-center font-mono text-[10px] text-ink-3">
            {agent.name} · <span className="italic">{agent.strategy}</span>
          </p>
        )}
      </div>
    </div>
  )
}
