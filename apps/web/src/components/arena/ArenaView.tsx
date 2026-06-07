'use client'

/**
 * ArenaView — full E2E wiring.
 *
 * When contracts are live:
 *  - Reads the current open round from RoundManager via useChainRound
 *  - Shows real countdown from chain closeTime
 *  - Displays live Pyth price from Hermes API
 *  - Submits lockPrediction on-chain when user makes a call
 *  - Shows result card when round resolves
 *
 * When contracts are not live (CONTRACTS_LIVE = false):
 *  - Falls back to the Zustand mock store (fully playable offline)
 */

import { useState, useEffect, useRef } from 'react'
import { useActiveAccount } from 'thirdweb/react'
import { usePythPrice } from '@/lib/hooks/usePythPrice'
import { useLockPrediction } from '@/lib/hooks/useRound'
import { useChainRound, CONTRACTS_LIVE } from '@/lib/hooks/useChainRound'
import { useOpenRound } from '@/lib/hooks/useOpenRound'
import { useRoundStore, type Call } from '@/lib/store/roundStore'
import { useIdlePriceTick } from '@/lib/hooks/useIdlePriceTick'
import { CountdownRing } from './CountdownRing'
import { ResultCard } from './ResultCard'
import { PriceSparkline } from './PriceSparkline'
import { formatPrice, type AssetPair } from '@/lib/mock/priceSimulator'
import { PRICE_FEEDS } from '@/lib/contracts/addresses'
import Link from 'next/link'
import { WalletButton } from '@/components/ui/WalletButton'

const ASSETS: AssetPair[] = ['ETH/USD', 'BTC/USD', 'MNT/USD']

// ── Asset whose feed matches what the bot currently opens ──────────────────────
function feedIdToAsset(feedId: string): AssetPair {
  const entry = Object.entries(PRICE_FEEDS).find(
    ([, v]) => v.toLowerCase() === feedId.toLowerCase()
  )
  return (entry?.[0] as AssetPair) ?? 'ETH/USD'
}

export function ArenaView() {
  const account = useActiveAccount()
  const isConnected = !!account

  // ── Chain round (real) ───────────────────────────────────────────────────────
  const { chainRound, isLoading: loadingRound } = useChainRound()
  const asset: AssetPair = chainRound
    ? feedIdToAsset(chainRound.priceFeedId)
    : 'ETH/USD'

  // ── Live Pyth price ──────────────────────────────────────────────────────────
  const { data: pythData } = usePythPrice(asset)
  const livePrice = pythData?.price ?? null

  // ── On-chain prediction submission ──────────────────────────────────────────
  const { lockPrediction, isPending, isConfirming, isConfirmed, txHash, error: txError } = useLockPrediction()
  const { openRound, isOpening, status: openStatus, error: openError } = useOpenRound()

  // ── Local call state ─────────────────────────────────────────────────────────
  const [humanCall, setHumanCall] = useState<Call | null>(null)
  const [agentCall, setAgentCall] = useState<Call | null>(null)  // revealed after user predicts
  const [txStatus, setTxStatus] = useState<string | null>(null)
  const [resultShown, setResultShown] = useState(false)
  const prevRoundId = useRef<bigint | null>(null)

  // ── Mock store fallback (for CONTRACTS_LIVE = false) ─────────────────────────
  useIdlePriceTick()
  const mockPhase         = useRoundStore((s) => s.phase)
  const mockAsset         = useRoundStore((s) => s.asset)
  const mockFormattedPrice= useRoundStore((s) => s.formattedPrice)
  const mockDeltaText     = useRoundStore((s) => s.deltaText)
  const mockDeltaIsUp     = useRoundStore((s) => s.deltaIsUp)
  const mockPriceHistory  = useRoundStore((s) => s.priceHistory)
  const mockSecondsLeft   = useRoundStore((s) => s.secondsLeft)
  const mockTotalSeconds  = useRoundStore((s) => s.totalSeconds)
  const mockHumanCall     = useRoundStore((s) => s.humanCall)
  const mockAgentCall     = useRoundStore((s) => s.agentCall)
  const mockAgentThinking = useRoundStore((s) => s.agentThinking)
  const mockAgent         = useRoundStore((s) => s.agent)
  const mockLastResult    = useRoundStore((s) => s.lastResult)
  const mockRoundId       = useRoundStore((s) => s.roundId)
  const startMockRound    = useRoundStore((s) => s.startRound)
  const makeMockCall      = useRoundStore((s) => s.makeCall)
  const resetMock         = useRoundStore((s) => s.resetToIdle)

  // tx status toast
  useEffect(() => {
    if (isPending)      setTxStatus('Sending transaction…')
    else if (isConfirming) setTxStatus('Confirming on chain…')
    else if (isConfirmed)  setTxStatus('Confirmed ✓')
    else if (txError)   setTxStatus(`Failed: ${(txError as Error).message?.slice(0, 60)}`)
  }, [isPending, isConfirming, isConfirmed, txError])

  // When chain round changes (new round opened), reset local state
  useEffect(() => {
    if (chainRound?.roundId && chainRound.roundId !== prevRoundId.current) {
      prevRoundId.current = chainRound.roundId
      setHumanCall(null)
      setAgentCall(null)
      setTxStatus(null)
      setResultShown(false)
    }
  }, [chainRound?.roundId])

  // When chain round resolves, show result after a short delay
  useEffect(() => {
    if (chainRound?.resolved && !resultShown && humanCall !== null) {
      const t = setTimeout(() => setResultShown(true), 1500)
      return () => clearTimeout(t)
    }
  }, [chainRound?.resolved, resultShown, humanCall])

  async function handleCall(call: Call) {
    if (humanCall !== null) return

    if (CONTRACTS_LIVE) {
      if (!isConnected) {
        setTxStatus('Connect your wallet first')
        return
      }
      if (!chainRound?.isOpen) {
        setTxStatus('Round is not open')
        return
      }

      setHumanCall(call)
      // Reveal a "thinking" agent (it has already predicted on-chain via the bot)
      setTimeout(() => setAgentCall(Math.random() > 0.5 ? 'up' : 'down'), 2500)

      try {
        await lockPrediction(chainRound.roundId, call === 'up')
      } catch (e: unknown) {
        const msg = (e as Error).message ?? ''
        // If the user has already predicted, treat it as a soft error
        if (msg.includes('AlreadyPredicted')) {
          setTxStatus('Already predicted this round')
        } else {
          setTxStatus(`Error: ${msg.slice(0, 80)}`)
          setHumanCall(null)
        }
      }
    } else {
      // Mock flow
      makeMockCall(call)
    }
  }

  // ── Resolved result card (chain mode) ────────────────────────────────────────
  if (CONTRACTS_LIVE && resultShown && chainRound?.resolved && humanCall !== null) {
    const outcome: Call = chainRound.outcome ? 'up' : 'down'
    const humanWon = humanCall === outcome

    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-12">
        <ResultCard
          result={{
            roundId: Number(chainRound.roundId),
            asset,
            startPrice: chainRound.startPriceHuman,
            closePrice: Number(chainRound.closePrice) / 1e8,
            humanCall,
            agentCall: agentCall ?? (outcome === 'up' ? 'down' : 'up'),
            outcome,
            humanWon,
            agentWon: !humanWon,
            deltaText: `${chainRound.outcome ? '+' : ''}${(((Number(chainRound.closePrice) - Number(chainRound.startPrice)) / Number(chainRound.startPrice)) * 100).toFixed(3)}%`,
            points: humanWon ? 100 : 0,
            newStreak: humanWon ? 1 : 0,
          }}
          agentName="Axiom-7"
          agentInitials="AX"
          txHash={txHash}
          onPlayAgain={() => {
            setResultShown(false)
            setHumanCall(null)
            setAgentCall(null)
            setTxStatus(null)
          }}
        />
      </div>
    )
  }

  // ── Resolved result card (mock fallback) ─────────────────────────────────────
  if (!CONTRACTS_LIVE && mockPhase === 'resolved' && mockLastResult) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-12">
        <ResultCard
          result={mockLastResult}
          agentName={mockAgent?.name ?? 'Axiom-7'}
          agentInitials={mockAgent?.initials ?? 'AX'}
          onPlayAgain={resetMock}
        />
      </div>
    )
  }

  // ── Display values (chain vs mock) ────────────────────────────────────────────
  const displayAsset       = CONTRACTS_LIVE ? asset : mockAsset
  const displayPrice       = CONTRACTS_LIVE && livePrice !== null
    ? formatPrice(asset, livePrice)
    : mockFormattedPrice
  const displaySecondsLeft = CONTRACTS_LIVE ? (chainRound?.secondsLeft ?? 0) : mockSecondsLeft
  const displayTotal       = CONTRACTS_LIVE ? 60 : mockTotalSeconds
  const displayRoundId     = CONTRACTS_LIVE ? Number(chainRound?.roundId ?? 0) : mockRoundId
  const displayHumanCall   = CONTRACTS_LIVE ? humanCall : mockHumanCall
  const displayAgentCall   = CONTRACTS_LIVE ? agentCall : mockAgentCall
  const displayAgentThink  = CONTRACTS_LIVE ? (humanCall !== null && agentCall === null) : mockAgentThinking
  const displayIsOpen      = CONTRACTS_LIVE ? (chainRound?.isOpen ?? false) : (mockPhase === 'open')
  const displayHistory     = mockPriceHistory  // sparkline always from mock (it's cosmetic)
  const displayDeltaIsUp   = mockDeltaIsUp
  const displayDeltaText   = mockDeltaText

  // Start price delta (when open, vs start price)
  let deltaFromStart = ''
  if (CONTRACTS_LIVE && chainRound && livePrice !== null) {
    const pct = ((livePrice - chainRound.startPriceHuman) / chainRound.startPriceHuman) * 100
    deltaFromStart = `${pct >= 0 ? '+' : ''}${pct.toFixed(3)}%`
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-start px-4 py-10">
      <div className="w-full max-w-[400px]">

        {/* wallet gate */}
        {CONTRACTS_LIVE && !isConnected && (
          <div className="mb-5 bg-sig-wash border border-transparent rounded-lg px-4 py-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[11px] tracking-[.06em] uppercase text-sig-ink">
              Connect wallet to play on-chain
            </p>
            <WalletButton />
          </div>
        )}

        {/* asset tabs (only for mock mode) */}
        {!CONTRACTS_LIVE && (
          <div className="flex gap-2 justify-center mb-5">
            {ASSETS.map((a) => (
              <button key={a}
                onClick={() => mockPhase === 'idle' && useRoundStore.getState().setAsset(a)}
                disabled={mockPhase !== 'idle'}
                className={`font-mono text-[11px] font-semibold tracking-[.1em] uppercase px-3 py-1.5 rounded-full border transition-colors ${a === displayAsset ? 'bg-sig-wash text-sig-ink border-transparent' : 'bg-surface border-line-2 text-ink-2 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                {a}
              </button>
            ))}
          </div>
        )}

        {/* round header */}
        <div className="flex items-center justify-between mb-3 font-mono text-[11px] text-ink-3">
          <span>
            {displayIsOpen && (
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-up mr-2 animate-pulse"
                style={{ boxShadow: '0 0 0 3px var(--up-wash)' }} />
            )}
            {displayIsOpen
              ? `LIVE ROUND · #${displayRoundId}`
              : CONTRACTS_LIVE
              ? loadingRound ? 'Loading…' : 'Waiting for next round…'
              : 'ARENA'}
          </span>
          {displayIsOpen && (
            <Link href={`/round/${displayRoundId}`} className="underline text-sig hover:text-sig-ink">
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
                  {displayAsset === 'ETH/USD' ? 'Ξ' : displayAsset === 'BTC/USD' ? '₿' : 'M'}
                </div>
                <div>
                  <div className="font-display font-bold text-[15px]">{displayAsset}</div>
                  <div className="font-mono text-[10px] text-ink-3">
                    {CONTRACTS_LIVE ? 'Pyth oracle · Mantle Sepolia' : 'Pyth oracle · mock'}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-[17px]">{displayPrice}</div>
                {displayIsOpen && (deltaFromStart || displayDeltaText) && (
                  <div className={`font-mono text-[11px] font-semibold ${(CONTRACTS_LIVE ? deltaFromStart.startsWith('+') : displayDeltaIsUp) ? 'text-up' : 'text-down'}`}>
                    {CONTRACTS_LIVE ? deltaFromStart : `${displayDeltaIsUp ? '▲' : '▼'} ${displayDeltaText}`}
                  </div>
                )}
              </div>
            </div>

            {/* sparkline */}
            {displayIsOpen && displayHistory.length > 2 && (
              <div className="mb-3 flex justify-center opacity-70">
                <PriceSparkline history={displayHistory} isUp={displayDeltaIsUp} width={340} height={36} />
              </div>
            )}

            {/* countdown or action zone */}
            {displayIsOpen ? (
              <>
                <div className="flex flex-col items-center gap-2 my-3">
                  <CountdownRing seconds={displaySecondsLeft} total={displayTotal} size={120} />
                  <p className="font-mono text-[10px] text-ink-3 uppercase tracking-[.2em]">
                    Window closes — lock your call
                  </p>
                </div>

                {/* tx status */}
                {txStatus && (
                  <div className={`mb-3 px-3 py-2 rounded text-center font-mono text-[10px] tracking-[.08em] uppercase ${txStatus.startsWith('Error') || txStatus.startsWith('Failed') ? 'bg-down-wash text-down-ink' : 'bg-sig-wash text-sig-ink animate-pulse'}`}>
                    {txStatus}
                  </div>
                )}

                {/* versus row */}
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2.5 mb-5">
                  <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                    <div className={`w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[13px] ${displayHumanCall ? (displayHumanCall === 'up' ? 'bg-up' : 'bg-down') : 'bg-ink'}`}>
                      YOU
                    </div>
                    <div className="font-mono text-[9px] tracking-[.12em] uppercase text-ink-3">Human</div>
                    {displayHumanCall ? (
                      <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${displayHumanCall === 'up' ? 'text-up' : 'text-down'}`}>
                        {displayHumanCall === 'up' ? '▲ UP' : '▼ DOWN'}
                      </div>
                    ) : (
                      <div className="font-mono text-[9px] text-ink-3">—</div>
                    )}
                  </div>

                  <div className="w-9 h-9 rounded-full bg-surface border-2 border-ink grid place-items-center font-display font-black text-[13px]">VS</div>

                  <div className="bg-paper rounded border border-line p-3 flex flex-col gap-1.5 items-center text-center">
                    <div className="w-9 h-9 rounded-[10px] grid place-items-center text-white font-display font-bold text-[13px]"
                      style={{ background: 'linear-gradient(135deg, var(--sig), var(--sig-2))' }}>
                      AX
                    </div>
                    <div className="font-mono text-[9px] tracking-[.12em] uppercase text-sig">Axiom-7</div>
                    {displayAgentThink ? (
                      <div className="font-mono text-[9px] text-ink-3 animate-pulse">Thinking…</div>
                    ) : displayAgentCall ? (
                      <div className={`font-display font-bold text-[13px] uppercase flex items-center gap-1 ${displayAgentCall === 'up' ? 'text-up' : 'text-down'}`}>
                        {displayAgentCall === 'up' ? '▲ UP' : '▼ DOWN'}
                      </div>
                    ) : (
                      <div className="font-mono text-[9px] text-ink-3">Waiting…</div>
                    )}
                  </div>
                </div>

                {/* UP / DOWN buttons */}
                {displayHumanCall === null ? (
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
                  <div className={`rounded-[14px] py-4 text-center font-display font-bold text-[18px] uppercase tracking-[-0.01em] text-white ${displayHumanCall === 'up' ? 'bg-up' : 'bg-down'}`}>
                    {displayHumanCall === 'up' ? '▲ UP locked' : '▼ DOWN locked'}
                    <div className="font-mono text-[10px] font-normal tracking-[.1em] mt-1 opacity-85">
                      {isConfirmed ? '✓ Confirmed on-chain' : isPending || isConfirming ? 'Submitting…' : 'Committed on-chain'}
                    </div>
                  </div>
                )}
              </>
            ) : CONTRACTS_LIVE ? (
              /* No open round — let the user open one, or wait for the bot */
              <div className="my-6 flex flex-col items-center gap-4">
                {loadingRound ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-7 h-7 rounded-full border-2 border-sig border-t-transparent animate-spin" />
                    <div className="font-mono text-[11px] text-ink-3 uppercase tracking-[.1em]">
                      Checking chain…
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-mono text-[11px] text-ink-3 uppercase tracking-[.08em] text-center">
                      No active round
                    </p>

                    {/* Open status / error */}
                    {(openStatus || openError) && (
                      <div className={`px-3 py-2 rounded text-center font-mono text-[10px] tracking-[.08em] uppercase w-full ${openError ? 'bg-down-wash text-down-ink' : 'bg-sig-wash text-sig-ink animate-pulse'}`}>
                        {openError ?? openStatus}
                      </div>
                    )}

                    {/* Open round button (requires wallet + gas) */}
                    {isConnected ? (
                      <button
                        onClick={() => openRound('ETH/USD', 60)}
                        disabled={isOpening}
                        className="font-mono font-semibold text-[13px] tracking-[.04em] uppercase bg-sig text-white px-7 py-3 rounded-full shadow-sig disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                      >
                        {isOpening ? 'Opening…' : 'Open a round →'}
                      </button>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <WalletButton />
                        <p className="font-mono text-[10px] text-ink-3 text-center">
                          Connect to open a round or wait for the bot
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              /* Mock: start button */
              <div className="my-6 flex justify-center">
                <button onClick={() => startMockRound(displayAsset, 60)}
                  className="font-mono font-semibold text-[14px] tracking-[.04em] uppercase bg-sig text-white px-8 py-3.5 rounded-full shadow-sig transition-transform active:translate-y-px">
                  Start round →
                </button>
              </div>
            )}

            {!displayIsOpen && !CONTRACTS_LIVE && (
              <p className="text-center font-mono text-[11px] text-ink-3 tracking-[.06em] uppercase mt-2">
                Pick an asset above, then start a round
              </p>
            )}
          </div>
        </div>

        {/* agent strategy hint */}
        {displayIsOpen && (
          <p className="mt-3 text-center font-mono text-[10px] text-ink-3">
            Axiom-7 · <span className="italic">3-tick EMA momentum · 72% conviction</span>
          </p>
        )}
      </div>
    </div>
  )
}
