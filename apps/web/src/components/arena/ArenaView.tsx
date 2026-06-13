'use client'

/**
 * ArenaView — Initnomo-style trading terminal.
 *
 * Layout:
 *   - Full-screen ArenaChart (dark, fills 100%)
 *   - Top strip (h-11): asset + live price + round badge
 *   - Neon countdown ring (absolute top-right): shows when round active
 *   - Floating betting panel (absolute bottom-left, 300px): ALL game interaction
 *   - Settlement toast (fixed bottom-right): auto-dismisses after result
 *
 * State machine (isLive path):
 *   idle        — no open round, user can start one
 *   waitingOpen — tx sent, waiting for chain to confirm new round
 *   open        — round live, no prediction yet → HIGHER / LOWER buttons
 *   locked      — prediction locked, waiting for round to close
 *   needsSettle — round closed, user participated → SETTLE button
 *   result      — round resolved, result known → show win/loss + New Round
 *
 * CRITICAL FIX: needsSettle only activates when humanCall !== null
 * (user actually participated this session). Arriving at the page with a
 * stale closed/unresolved round never blocks the user.
 */

import { useState, useEffect, useRef } from 'react'
import { useActiveAccount }           from 'thirdweb/react'
import { useQueryClient }             from '@tanstack/react-query'
import { createPublicClient, http }   from 'viem'
import { usePythPrice }               from '@/lib/hooks/usePythPrice'
import { useLockPrediction }          from '@/lib/hooks/useRound'
import { useChainRound, CONTRACTS_LIVE } from '@/lib/hooks/useChainRound'
import { useOpenRound }               from '@/lib/hooks/useOpenRound'
import { useResolveRound }            from '@/lib/hooks/useResolveRound'
import { useRoundStore, type Call, type PricePoint } from '@/lib/store/roundStore'
import { useIdlePriceTick }           from '@/lib/hooks/useIdlePriceTick'
import { useRoundTimer }              from '@/lib/hooks/useRoundTimer'
import { getDurationMultiplier }      from './ResultModal'
import { ArenaChart }                 from './ArenaChart'
import { ResultModal }               from './ResultModal'
import { formatPrice, type AssetPair } from '@/lib/mock/priceSimulator'
import { PRICE_FEEDS, CONTRACTS, AGENT_WALLET } from '@/lib/contracts/addresses'
import { PREDICTION_REGISTRY_ABI }    from '@/lib/contracts/abis'
import { mantleSepolia }              from '@/lib/contracts/chain'
import Link                           from 'next/link'

// Viem client for reading bot's on-chain prediction (no thirdweb cache)
const viemPublicClient = createPublicClient({
  chain: {
    id: mantleSepolia.id,
    name: mantleSepolia.name,
    nativeCurrency: mantleSepolia.nativeCurrency,
    rpcUrls: { default: { http: [mantleSepolia.rpcUrls.default.http[0]] } },
  } as any,
  transport: http(),
})

// Poll PredictionRegistry until the bot has submitted its on-chain call.
// Returns the bot's call, or null if it never predicts within the timeout.
async function pollBotPrediction(roundId: bigint, signal: AbortSignal, durationSeconds = 60): Promise<Call | null> {
  const deadline = Date.now() + Math.max(durationSeconds - 5, 10) * 1000  // stop 5s before close
  while (Date.now() < deadline && !signal.aborted) {
    try {
      const predicted = await viemPublicClient.readContract({
        address: CONTRACTS.PredictionRegistry as `0x${string}`,
        abi: PREDICTION_REGISTRY_ABI,
        functionName: 'hasPredicted',
        args: [roundId, AGENT_WALLET as `0x${string}`],
      })
      if (predicted) {
        const isUp = await viemPublicClient.readContract({
          address: CONTRACTS.PredictionRegistry as `0x${string}`,
          abi: PREDICTION_REGISTRY_ABI,
          functionName: 'prediction',
          args: [roundId, AGENT_WALLET as `0x${string}`],
        })
        return isUp ? 'up' : 'down'
      }
    } catch {
      // RPC hiccup — retry
    }
    // Wait 3 seconds between polls
    await new Promise<void>(res => {
      const id = setTimeout(res, 3000)
      signal.addEventListener('abort', () => { clearTimeout(id); res() }, { once: true })
    })
  }
  return null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function feedIdToAsset(feedId: string): AssetPair {
  const entry = Object.entries(PRICE_FEEDS).find(
    ([, v]) => v.toLowerCase() === feedId.toLowerCase()
  )
  return (entry?.[0] as AssetPair) ?? 'ETH/USD'
}

// ── Neon countdown ring ───────────────────────────────────────────────────────
function NeonRing({ seconds, total, onSettle, canSettle, isSettling }: {
  seconds: number; total: number
  onSettle?: () => void; canSettle: boolean; isSettling?: boolean
}) {
  const CIRC   = 2 * Math.PI * 48
  const pct    = Math.max(0, seconds / Math.max(total, 1))
  const offset = CIRC * (1 - pct)
  const warn   = seconds > 0 && seconds <= 10
  const done   = seconds <= 0
  const color  = warn ? '#fbbf24' : '#00ff9d'

  return (
    <div className="relative flex items-center justify-center cursor-pointer"
      style={{ width: 100, height: 100, borderRadius: '50%',
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)',
        boxShadow: `0 0 24px ${color}28, inset 0 0 20px rgba(0,0,0,0.5)` }}>
      <svg viewBox="0 0 108 108" width={100} height={100} className="absolute"
        style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx="54" cy="54" r="48" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
        <circle cx="54" cy="54" r="48" fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s linear',
            filter: `drop-shadow(0 0 5px ${color}88)` }} />
      </svg>

      {done && canSettle ? (
        <button onClick={onSettle} disabled={isSettling}
          className="relative z-10 flex flex-col items-center gap-0.5 disabled:opacity-60">
          <span className="font-mono font-black text-[12px] tracking-[.1em] uppercase"
            style={{ color: '#00ff9d', textShadow: '0 0 8px #00ff9d88' }}>
            {isSettling ? '…' : 'SETTLE'}
          </span>
        </button>
      ) : (
        <div className="relative z-10 flex flex-col items-center pointer-events-none">
          <span className="font-display font-black text-[30px] leading-none tabular-nums"
            style={{ color, textShadow: `0 0 12px ${color}55`,
              animation: warn ? 'pulse 0.8s ease-in-out infinite' : 'none' }}>
            {seconds}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[.18em] text-white/30">sec</span>
        </div>
      )}
    </div>
  )
}

// ── Settlement toast ──────────────────────────────────────────────────────────
function SettlementToast({ humanWon, humanCall, agentCall, outcome, deltaText, txHash, onDismiss, onPlayAgain }: {
  humanWon: boolean; humanCall: Call; agentCall: Call; outcome: Call
  deltaText: string; txHash?: string; onDismiss: () => void; onPlayAgain: () => void
}) {
  const [bar, setBar] = useState(1)
  useEffect(() => {
    const t0 = Date.now()
    const dur = 7000
    const id = setInterval(() => {
      const p = (Date.now() - t0) / dur
      setBar(1 - p)
      if (p >= 1) { clearInterval(id); onDismiss() }
    }, 40)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  const dot = humanWon ? '#10b981' : '#f43f5e'

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-xl overflow-hidden"
      style={{ background: humanWon ? 'rgba(3,30,18,0.97)' : 'rgba(40,5,12,0.97)',
        border: `1px solid ${humanWon ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}`,
        boxShadow: `0 0 30px ${dot}22` }}>
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: dot, boxShadow: `0 0 6px ${dot}` }} />
            <span className="font-mono font-bold text-[13px] uppercase tracking-[.08em]"
              style={{ color: dot }}>{humanWon ? 'You Won!' : 'You Lost'}</span>
          </div>
          <button onClick={onDismiss} className="text-white/30 hover:text-white/60 text-lg leading-none">×</button>
        </div>
        <div className="flex items-center gap-2 font-mono text-[12px] text-white/55 mb-3">
          <span style={{ color: humanCall === 'up' ? '#10b981' : '#f43f5e' }}>
            {humanCall === 'up' ? '▲' : '▼'} You
          </span>
          <span>vs</span>
          <span style={{ color: agentCall === 'up' ? '#10b981' : '#f43f5e' }}>
            {agentCall === 'up' ? '▲' : '▼'} Axiom-7
          </span>
          <span className="ml-auto font-semibold" style={{ color: dot }}>
            ETH {outcome === 'up' ? '▲' : '▼'} {deltaText}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPlayAgain}
            className="flex-1 font-mono text-[11px] font-bold uppercase tracking-[.06em] py-2 rounded-lg text-white"
            style={{ background: '#6C2BF2', boxShadow: '0 0 12px rgba(108,43,242,0.4)' }}>
            New Round →
          </button>
          {txHash && (
            <a href={`https://sepolia.mantlescan.xyz/tx/${txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="font-mono text-[10px] text-white/30 hover:text-white/60 px-2 py-2 border border-white/10 rounded-lg">
              ▦ TX
            </a>
          )}
        </div>
      </div>
      <div className="h-0.5 bg-white/[0.04]">
        <div className="h-full" style={{ width: `${bar * 100}%`, background: dot, transition: 'none' }} />
      </div>
    </div>
  )
}

// ── Frozen snapshot of resolved round ────────────────────────────────────────
interface FrozenResult { roundId: bigint; outcome: boolean; startPriceHuman: number; closePriceHuman: number }

// ── Main ──────────────────────────────────────────────────────────────────────
export function ArenaView({ gauntletMode = false }: { gauntletMode?: boolean } = {}) {
  // gauntletMode=true forces mock path regardless of CONTRACTS_LIVE
  // forceMock is set when the user clicks "Start Xs Round" from the idle panel —
  // it overrides isLive so the mock path handles all display + round logic.
  // This fixes 15s/30s rounds which would otherwise expire before the 5–8s
  // chain-polling cycle could detect them, making them appear to never open.
  const [forceMock, setForceMock] = useState(false)
  const isLive = CONTRACTS_LIVE && !gauntletMode && !forceMock

  const account      = useActiveAccount()
  const isConnected  = !!account
  const queryClient  = useQueryClient()

  const { chainRound, isLoading: loadingRound } = useChainRound()
  const asset: AssetPair = chainRound ? feedIdToAsset(chainRound.priceFeedId) : 'ETH/USD'

  const { data: pythData } = usePythPrice(asset)
  const livePrice = pythData?.price ?? null

  // Accumulate live price history
  const [liveHistory, setLiveHistory] = useState<PricePoint[]>([])
  const liveRef                        = useRef<PricePoint[]>([])
  const prevPriceRound                 = useRef<bigint | null>(null)

  useEffect(() => {
    if (!isLive || livePrice === null) return
    if (chainRound?.roundId && chainRound.roundId !== prevPriceRound.current) {
      liveRef.current = []
      prevPriceRound.current = chainRound.roundId
    }
    liveRef.current = [...liveRef.current, { t: Date.now(), price: livePrice }].slice(-120)
    setLiveHistory([...liveRef.current])
  }, [livePrice]) // eslint-disable-line

  // On-chain hooks
  const { lockPrediction, isPending, isConfirming, isConfirmed, txHash, error: txError } = useLockPrediction()
  const { openRound, isOpening, status: openStatus, error: openError } = useOpenRound()
  const { resolveRound, isResolving, error: resolveError, status: resolveStatus } = useResolveRound()

  // Local game state
  const [humanCall,        setHumanCall]        = useState<Call | null>(null)
  const [agentCall,        setAgentCall]        = useState<Call | null>(null)
  const [txMsg,            setTxMsg]            = useState<string | null>(null)
  const [resultShown,      setResultShown]      = useState(false)
  const [frozenResult,     setFrozenResult]     = useState<FrozenResult | null>(null)
  const [showToast,        setShowToast]        = useState(false)
  const [waitingOpen,      setWaitingOpen]      = useState(false)
  const [selectedDuration, setSelectedDuration] = useState(60)
  const prevRoundId                             = useRef<bigint | null>(null)
  const autoSettledRoundId                      = useRef<bigint | null>(null)

  // Mock store — timer drives the 1-second countdown when a mock round is open
  useIdlePriceTick()
  useRoundTimer()
  const mockPhase          = useRoundStore(s => s.phase)
  const mockAsset          = useRoundStore(s => s.asset)
  const mockFormattedPrice = useRoundStore(s => s.formattedPrice)
  const mockDeltaText      = useRoundStore(s => s.deltaText)
  const mockDeltaIsUp      = useRoundStore(s => s.deltaIsUp)
  const mockPriceHistory   = useRoundStore(s => s.priceHistory)
  const mockSecondsLeft    = useRoundStore(s => s.secondsLeft)
  const mockTotalSeconds   = useRoundStore(s => s.totalSeconds)
  const mockHumanCall      = useRoundStore(s => s.humanCall)
  const mockAgentCall      = useRoundStore(s => s.agentCall)
  const mockLastResult     = useRoundStore(s => s.lastResult)
  const mockRoundId        = useRoundStore(s => s.roundId)
  const mockStartPrice     = useRoundStore(s => s.startPrice)
  const startMockRound     = useRoundStore(s => s.startRound)
  const makeMockCall       = useRoundStore(s => s.makeCall)
  const resetMock          = useRoundStore(s => s.resetToIdle)

  // Tx status message
  useEffect(() => {
    if (isPending)         setTxMsg('Sending transaction…')
    else if (isConfirming) setTxMsg('Confirming on-chain…')
    else if (isConfirmed)  setTxMsg('Confirmed ✓')
    else if (txError)      setTxMsg('Transaction failed')
  }, [isPending, isConfirming, isConfirmed, txError])

  // When round opens after user started one, clear waitingOpen
  useEffect(() => {
    if (chainRound?.isOpen && waitingOpen) setWaitingOpen(false)
  }, [chainRound?.isOpen, waitingOpen])

  // Safety escape: if we've been waiting 90 s and the round still hasn't
  // opened, bail out so the user isn't stuck on the spinner forever.
  useEffect(() => {
    if (!waitingOpen) return
    const t = setTimeout(() => setWaitingOpen(false), 90_000)
    return () => clearTimeout(t)
  }, [waitingOpen])

  // Mock round resolved → trigger full ResultModal (same as Gauntlet final report)
  // gauntletMode: skip — ChallengeView owns the result flow there
  useEffect(() => {
    if (mockPhase !== 'resolved' || !mockLastResult || gauntletMode) return
    const fr: FrozenResult = {
      roundId:         BigInt(mockLastResult.roundId),
      outcome:         mockLastResult.outcome === 'up',
      startPriceHuman: mockLastResult.startPrice,
      closePriceHuman: mockLastResult.closePrice,
    }
    setFrozenResult(fr)
    const t = setTimeout(() => setResultShown(true), 600)
    return () => clearTimeout(t)
  }, [mockPhase]) // eslint-disable-line

  // Fallback: if chainRound.resolved becomes true via polling (e.g. bot resolved
  // before user clicked Settle), capture result from poll data.
  // handleSettle takes the fast path and sets frozenResult directly, so
  // !frozenResult guards against double-firing.
  useEffect(() => {
    if (chainRound?.resolved && humanCall !== null && !frozenResult) {
      const fr = {
        roundId:          chainRound.roundId,
        outcome:          chainRound.outcome,
        startPriceHuman:  chainRound.startPriceHuman,
        closePriceHuman:  Number(chainRound.closePrice) / 1e8,
      }
      setFrozenResult(fr)
      const t = setTimeout(() => { setResultShown(true); setShowToast(true) }, 900)
      return () => clearTimeout(t)
    }
  }, [chainRound?.resolved, humanCall, frozenResult])

  // New round opened → reset state ONLY if not showing result
  useEffect(() => {
    if (chainRound?.roundId && chainRound.roundId !== prevRoundId.current) {
      prevRoundId.current = chainRound.roundId
      if (!resultShown) {
        setHumanCall(null); setAgentCall(null)
        setTxMsg(null); setFrozenResult(null)
      }
    }
  }, [chainRound?.roundId, resultShown])

  // ── Handlers ──────────────────────────────────────────────────────────────
  // Ref to abort the bot-poll when the round ends / component unmounts
  const botPollAbort = useRef<AbortController | null>(null)

  async function handleCall(call: Call) {
    if (humanCall !== null) return
    if (isLive) {
      if (!isConnected || !chainRound?.isOpen) return
      setHumanCall(call)

      // Start polling for the bot's REAL on-chain prediction.
      // Aborts any previous poll and keeps agentCall null ("Thinking…")
      // until the bot's tx is confirmed on-chain.
      botPollAbort.current?.abort()
      const abort = new AbortController()
      botPollAbort.current = abort
      const roundId = chainRound.roundId
      pollBotPrediction(roundId, abort.signal, selectedDuration).then(botCall => {
        if (!abort.signal.aborted && botCall !== null) {
          setAgentCall(botCall)
        }
      })

      try {
        await lockPrediction(chainRound.roundId, call === 'up')
      } catch (e: unknown) {
        const msg = (e as Error).message ?? ''
        if (msg.includes('AlreadyPredicted')) setTxMsg('Already predicted this round')
        else { setTxMsg('Transaction failed'); setHumanCall(null) }
      }
    } else {
      makeMockCall(call)
    }
  }

  async function handleStartRound() {
    setWaitingOpen(true)
    try {
      await openRound(displayAsset, selectedDuration)
      // Immediately invalidate so wagmi re-fetches nextRoundId/getRound
      // and the round appears as open as soon as the tx confirms.
      queryClient.invalidateQueries()
    } catch {
      setWaitingOpen(false)
    }
  }

  async function handleSettle() {
    if (!chainRound) return
    const startPriceHuman = chainRound.startPriceHuman
    try {
      const data = await resolveRound(chainRound.roundId, chainRound.priceFeedId)
      if (data) {
        // Update agentCall with the real on-chain prediction (was previously random)
        if (data.agentCall !== null) setAgentCall(data.agentCall)
        setFrozenResult({
          roundId:         data.roundId,
          outcome:         data.outcome,
          startPriceHuman: startPriceHuman,
          closePriceHuman: Number(data.closePrice) / 1e8,
        })
        setTimeout(() => { setResultShown(true); setShowToast(true) }, 900)
      }
      queryClient.invalidateQueries()
    } catch {
      /* error shown in hook */
    }
  }

  function handlePlayAgain() {
    botPollAbort.current?.abort()
    setResultShown(false); setShowToast(false)
    setHumanCall(null); setAgentCall(null)
    setTxMsg(null); setFrozenResult(null)
    setWaitingOpen(false)
    setForceMock(false)   // return to live mode — bot rounds will show again
    resetMock()           // also clear mock store so the idle panel shows
  }

  // ── Derived display values ────────────────────────────────────────────────
  const displayAsset       = isLive ? asset : mockAsset
  const displayPrice       = isLive && livePrice !== null ? formatPrice(asset, livePrice) : mockFormattedPrice
  const displaySecondsLeft = isLive ? (chainRound?.secondsLeft ?? 0) : mockSecondsLeft
  const displayTotal       = isLive ? (chainRound?.totalDuration ?? selectedDuration) : mockTotalSeconds
  const displayRoundId     = isLive ? Number(chainRound?.roundId ?? 0) : mockRoundId
  const displayHumanCall   = isLive ? humanCall : mockHumanCall
  const displayAgentCall   = isLive ? agentCall : mockAgentCall
  const displayIsOpen      = isLive ? (chainRound?.isOpen ?? false) : (mockPhase === 'open')
  const displayIsResolved  = isLive ? (chainRound?.resolved ?? false) : (mockPhase === 'resolved')

  const chartHistory: PricePoint[] = isLive && liveHistory.length > 1
    ? liveHistory : mockPriceHistory
  const chartStartPrice = isLive
    ? chainRound?.startPriceHuman
    : (mockPhase === 'open' ? mockStartPrice : undefined)

  let deltaFromStart = ''; let deltaPos = true
  if (isLive && chainRound && livePrice !== null) {
    const pct = ((livePrice - chainRound.startPriceHuman) / chainRound.startPriceHuman) * 100
    deltaPos = pct >= 0
    deltaFromStart = `${pct >= 0 ? '+' : ''}${pct.toFixed(3)}%`
  } else if (!isLive && mockPhase === 'open') {
    deltaFromStart = mockDeltaText; deltaPos = mockDeltaIsUp
  }

  // ── CRITICAL: needsSettle only when user participated ────────────────────
  // Without this gate, every closed-but-unresolved round blocks the user
  // even if they just arrived at the page.
  const needsSettle = isLive
    && humanCall !== null        // user made a prediction this session
    && displaySecondsLeft <= 0   // round window has closed
    && !displayIsResolved        // not yet resolved
    && chainRound !== null
    && !resultShown

  // Auto-settle: fire the moment the round closes so the recorded price is as
  // close as possible to the actual close price.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isLive || !needsSettle || isResolving || !chainRound) return
    if (autoSettledRoundId.current === chainRound.roundId) return
    autoSettledRoundId.current = chainRound.roundId
    handleSettle()
  }, [needsSettle]) // intentionally narrow — only re-run when needsSettle flips

  // ── Panel state machine ──────────────────────────────────────────────────
  type PS = 'idle'|'waitingOpen'|'open'|'locked'|'needsSettle'|'result'|'mIdle'|'mOpen'|'mResult'
  const ps: PS = !isLive
    ? (mockPhase === 'idle' ? 'mIdle' : mockPhase === 'open' ? 'mOpen' : 'mResult')
    : resultShown        ? 'result'
    : needsSettle        ? 'needsSettle'
    : displayIsOpen && displayHumanCall !== null ? 'locked'
    : displayIsOpen      ? 'open'
    : waitingOpen        ? 'waitingOpen'
    : 'idle'

  // Result data
  const resOutcome: Call | null = resultShown
    ? (isLive ? (frozenResult?.outcome ? 'up' : 'down') : mockLastResult?.outcome ?? null)
    : null

  // 3-state result: the game is head-to-head "beat the AI".
  //   WIN  — you called it right, bot called it wrong
  //   LOSE — bot called it right, you called it wrong
  //   DRAW — both made the same call (neither out-predicted the other)
  //          This covers: both right, both wrong, or bot didn't predict
  const resVerdict: 'win' | 'lose' | 'draw' = (() => {
    if (!resultShown || resOutcome === null) return 'draw'
    if (isLive) {
      const humanRight = humanCall === resOutcome
      const agentRight = agentCall === resOutcome
      if (humanCall === agentCall) return 'draw'    // same call → draw
      if (humanRight && !agentRight) return 'win'
      if (!humanRight && agentRight) return 'lose'
      return 'draw'
    }
    // Mock head-to-head: compare calls directly against outcome
    const mhc = mockLastResult?.humanCall ?? null
    const mac = mockLastResult?.agentCall ?? null
    if (mhc === mac) return 'draw'                         // same call → draw
    if (mhc === resOutcome && mac !== resOutcome) return 'win'
    if (mhc !== resOutcome && mac === resOutcome) return 'lose'
    return 'draw'                                          // fallback
  })()

  const resHumanWon = resVerdict === 'win'

  const resDelta = resultShown
    ? (isLive ? (() => {
        const pct = ((frozenResult!.closePriceHuman - frozenResult!.startPriceHuman) / frozenResult!.startPriceHuman) * 100
        return `${pct >= 0 ? '+' : ''}${pct.toFixed(3)}%`
      })() : mockLastResult?.deltaText ?? '')
    : ''

  // Panel gradient
  const panelBg = 'linear-gradient(145deg, rgba(2,4,10,0.97) 0%, rgba(70,20,120,0.12) 50%, rgba(2,4,10,0.97) 100%)'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden" style={{ height: 'calc(100dvh - 64px)', background: '#02040A' }}>

      {/* ── Full-screen chart ─────────────────────────────────────────── */}
      <ArenaChart
        history={chartHistory}
        startPrice={displayIsOpen ? chartStartPrice : undefined}
        liveMode={displayIsOpen || (isLive && livePrice !== null)}
        roundActive={displayIsOpen}
        humanCall={displayHumanCall}
        secondsLeft={displaySecondsLeft}
        totalSeconds={displayTotal}
      />

      {/* ── Top info strip ───────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-0 px-5 h-11"
        style={{ background: 'rgba(2,4,10,0.90)', backdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Asset */}
        <div className="flex items-center gap-2 pr-4 border-r border-white/[0.06]">
          <div className="w-6 h-6 rounded-full grid place-items-center text-white font-display font-bold text-[11px]"
            style={{ background: 'conic-gradient(from 200deg, #6C2BF2, #9A6BFF)' }}>
            {displayAsset === 'ETH/USD' ? 'Ξ' : displayAsset === 'BTC/USD' ? '₿' : 'M'}
          </div>
          <span className="font-display font-bold text-[13px] text-white">{displayAsset}</span>
          <span className="font-mono text-[9px] text-white/25 uppercase tracking-[.1em] hidden sm:block">
            {isLive ? 'PYTH · LIVE' : 'PYTH · MOCK'}
          </span>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 px-4 border-r border-white/[0.06]">
          <span className="font-mono font-bold text-[16px] text-white tabular-nums">{displayPrice}</span>
          {deltaFromStart && displayIsOpen && (
            <span className={`font-mono text-[11px] font-semibold ${deltaPos ? 'text-[#10b981]' : 'text-[#f43f5e]'}`}>
              {deltaPos ? '▲' : '▼'} {deltaFromStart.replace(/^[+-]/, '')}
            </span>
          )}
        </div>

        {/* Round badge */}
        {displayIsOpen && (
          <div className="flex items-center gap-2 px-4 border-r border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"
              style={{ boxShadow: '0 0 6px #10b981' }} />
            <span className="font-mono text-[11px] text-white/55 uppercase tracking-[.08em]">
              Round #{displayRoundId}
            </span>
            <Link href={`/round/${displayRoundId}`}
              className="font-mono text-[9px] text-white/20 hover:text-white/45 transition-colors">
              ▦
            </Link>
          </div>
        )}

        {/* Duration chip — shown whenever a round is active */}
        {displayIsOpen && displayTotal > 0 && (
          <div className="flex items-center gap-1.5 px-4 border-r border-white/[0.06]">
            <span className="font-mono text-[11px] text-white/55">
              {displayTotal}s
            </span>
            {getDurationMultiplier(displayTotal) > 1 && (
              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(108,43,242,0.25)', color: '#9A6BFF' }}>
                {getDurationMultiplier(displayTotal)}×
              </span>
            )}
          </div>
        )}

        <div className="flex-1" />

        {/* Mock asset switcher */}
        {!isLive && mockPhase === 'idle' && (
          <div className="flex gap-1.5">
            {(['ETH/USD', 'BTC/USD', 'MNT/USD'] as AssetPair[]).map(a => (
              <button key={a} onClick={() => useRoundStore.getState().setAsset(a)}
                className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${a === displayAsset ? 'bg-[#6C2BF2]/30 text-[#9A6BFF]' : 'text-white/30 hover:text-white/55'}`}>
                {a.split('/')[0]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Neon countdown (top-right, when round active or needs settle) ─── */}
      {(displayIsOpen || needsSettle) && (
        <div className="absolute top-16 right-6 z-20">
          <NeonRing
            seconds={displaySecondsLeft}
            total={displayTotal}
            onSettle={handleSettle}
            canSettle={needsSettle}
            isSettling={isResolving}
          />
        </div>
      )}

      {/* ── Floating betting panel (bottom-left) ──────────────────────── */}
      <div className="absolute bottom-6 left-6 z-20 w-[300px] rounded-2xl overflow-hidden"
        style={{ background: panelBg,
          border: '1px solid rgba(108,43,242,0.22)',
          backdropFilter: 'blur(22px)',
          boxShadow: '0 0 50px rgba(0,0,0,0.85), 0 0 24px rgba(108,43,242,0.08)' }}>

        {/* ── IDLE / Mock Idle ── */}
        {(ps === 'idle' || ps === 'mIdle') && (
          <div className="p-5">
            <div className="font-mono text-[10px] text-white/25 uppercase tracking-[.14em] mb-1">
              KLYRO ARENA {isLive ? '' : '· MOCK'}
            </div>
            <div className="font-display font-black text-[18px] text-white mb-1">
              Beat the AI
            </div>
            <div className="font-mono text-[11px] text-white/40 leading-relaxed mb-4">
              Predict if {displayAsset.split('/')[0]} will rise or fall in your chosen window.
              {isLive && !isConnected && (
                <span className="block mt-2 text-[#9A6BFF]">
                  Connect wallet via the button in the top bar to play.
                </span>
              )}
            </div>

            {/* Duration picker */}
            <div className="mb-4">
              <div className="font-mono text-[9px] tracking-[.14em] uppercase text-white/25 mb-2">Round duration</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { s: 15, label: '15s', bonus: '4×' },
                  { s: 30, label: '30s', bonus: '2×' },
                  { s: 45, label: '45s', bonus: '1.5×' },
                  { s: 60, label: '60s', bonus: '1×' },
                ].map(({ s, label, bonus }) => {
                  const active = selectedDuration === s
                  return (
                    <button key={s} onClick={() => setSelectedDuration(s)}
                      className="flex flex-col items-center py-2 rounded-xl transition-all"
                      style={{
                        background: active ? 'rgba(108,43,242,0.25)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${active ? 'rgba(108,43,242,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      <span className="font-mono font-bold text-[12px]"
                        style={{ color: active ? '#9A6BFF' : 'rgba(255,255,255,0.5)' }}>{label}</span>
                      <span className="font-mono text-[8px] tracking-[.06em] mt-0.5"
                        style={{ color: active ? '#6C2BF2' : 'rgba(255,255,255,0.2)' }}>{bonus}</span>
                    </button>
                  )
                })}
              </div>
              <div className="font-mono text-[9px] text-white/20 mt-1.5 text-center">
                Faster rounds earn more points · {selectedDuration}s selected
              </div>
            </div>

            {openError && (
              <div className="mb-3 font-mono text-[10px] text-[#f43f5e] leading-tight bg-[#f43f5e]/10 rounded-lg px-3 py-2">
                {openError}
              </div>
            )}

            {/* Start Round — on-chain when contracts live + wallet connected, mock otherwise */}
            <button
              disabled={CONTRACTS_LIVE && !isConnected}
              onClick={() => {
                if (!CONTRACTS_LIVE) {
                  // Contracts not yet deployed — fall back to simulated play
                  setForceMock(true)
                  startMockRound(displayAsset, selectedDuration)
                  return
                }
                // Live contracts: require wallet connection, then go on-chain
                if (!isConnected) return
                handleStartRound()
              }}
              className="w-full py-3.5 rounded-xl font-mono font-bold text-[13px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #6C2BF2, #7c3af5)',
                boxShadow: '0 0 28px rgba(108,43,242,0.50)' }}>
              {CONTRACTS_LIVE && !isConnected
                ? '🔗  Connect Wallet to Play'
                : `◼  Start ${selectedDuration}s Round  →`}
            </button>
          </div>
        )}

        {/* ── WAITING OPEN ── */}
        {ps === 'waitingOpen' && (
          <div className="p-5 flex flex-col items-center gap-4">
            {openError ? (
              <>
                <div className="text-[22px]">⚠️</div>
                <div className="font-mono text-[11px] text-[#f43f5e] uppercase tracking-[.08em] text-center">
                  Transaction failed
                </div>
                <div className="font-mono text-[9px] text-white/30 text-center leading-relaxed max-w-[180px]">
                  {openError}
                </div>
                <button
                  onClick={() => { setWaitingOpen(false) }}
                  className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[.08em] px-4 py-2 rounded-lg transition-colors"
                  style={{ background: 'rgba(108,43,242,0.15)', color: '#9A6BFF', border: '1px solid rgba(108,43,242,0.3)' }}>
                  ← Try again
                </button>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full border-2 border-[#6C2BF2] border-t-transparent animate-spin" />
                <div className="font-mono text-[11px] text-white/45 uppercase tracking-[.1em] text-center">
                  {openStatus ?? 'Opening round on-chain…'}
                </div>
                <div className="font-mono text-[9px] text-white/20 text-center">
                  Waiting for transaction to confirm
                </div>
              </>
            )}
          </div>
        )}

        {/* ── ROUND OPEN: make a prediction ── */}
        {(ps === 'open' || ps === 'mOpen') && (
          <div className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-[.12em]">
                Round #{displayRoundId}
              </span>
              <span className="font-mono text-[10px] font-semibold text-[#10b981] tracking-[.06em]">
                ● LIVE
              </span>
            </div>

            {/* Instruction */}
            <div className="font-mono text-[11px] text-white/45 mb-4 leading-relaxed">
              Will ETH go <span className="text-[#10b981] font-semibold">higher</span> or{' '}
              <span className="text-[#f43f5e] font-semibold">lower</span> in{' '}
              {displayTotal}s?
              {isLive && !isConnected && (
                <span className="block mt-1.5 text-[#9A6BFF]">Connect wallet to play.</span>
              )}
            </div>

            {/* HIGHER / LOWER buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleCall('up')}
                disabled={isLive && !isConnected}
                className="flex flex-col items-center py-5 rounded-xl transition-all active:scale-[.95] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(16,185,129,0.10)',
                  border: '1px solid rgba(16,185,129,0.30)',
                  color: '#10b981',
                  boxShadow: 'inset 0 0 20px rgba(16,185,129,0.05)' }}>
                <span className="text-[26px] leading-none mb-1">▲</span>
                <span className="font-display font-black text-[15px] uppercase tracking-[0.02em]">Higher</span>
                <small className="font-mono text-[9px] opacity-55 tracking-[.06em] mt-0.5 normal-case">price rises</small>
              </button>
              <button
                onClick={() => handleCall('down')}
                disabled={isLive && !isConnected}
                className="flex flex-col items-center py-5 rounded-xl transition-all active:scale-[.95] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(244,63,94,0.10)',
                  border: '1px solid rgba(244,63,94,0.30)',
                  color: '#f43f5e',
                  boxShadow: 'inset 0 0 20px rgba(244,63,94,0.05)' }}>
                <span className="text-[26px] leading-none mb-1">▼</span>
                <span className="font-display font-black text-[15px] uppercase tracking-[0.02em]">Lower</span>
                <small className="font-mono text-[9px] opacity-55 tracking-[.06em] mt-0.5 normal-case">price falls</small>
              </button>
            </div>
          </div>
        )}

        {/* ── LOCKED: prediction made, waiting for close ── */}
        {ps === 'locked' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-[.12em]">Round #{displayRoundId}</span>
              <span className="font-mono text-[10px] font-semibold text-[#10b981]">● LIVE</span>
            </div>

            {/* Your call */}
            <div className="mb-4 px-4 py-3 rounded-xl border"
              style={{ borderColor: displayHumanCall === 'up' ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)',
                background: displayHumanCall === 'up' ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)' }}>
              <div className="font-mono text-[10px] text-white/35 uppercase tracking-[.1em] mb-1">Your call</div>
              <div className="font-display font-black text-[18px]"
                style={{ color: displayHumanCall === 'up' ? '#10b981' : '#f43f5e' }}>
                {displayHumanCall === 'up' ? '▲ HIGHER' : '▼ LOWER'}
              </div>
            </div>

            {/* AI call */}
            <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03]">
              <div className="w-6 h-6 rounded-md grid place-items-center font-display font-black text-[10px] text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #6C2BF2, #9A6BFF)' }}>AX</div>
              <div className="flex-1 font-mono text-[11px]">
                {displayAgentCall ? (
                  <span style={{ color: displayAgentCall === 'up' ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                    {displayAgentCall === 'up' ? '▲ HIGHER' : '▼ LOWER'}
                  </span>
                ) : <span className="text-white/30 animate-pulse">Thinking…</span>}
              </div>
              <span className="font-mono text-[9px] text-white/25">Axiom-7</span>
            </div>

            {/* Tx status */}
            <div className="font-mono text-[10px] text-center uppercase tracking-[.08em]"
              style={{ color: txMsg?.includes('✓') ? '#10b981' : txMsg?.includes('fail') ? '#f43f5e' : 'rgba(255,255,255,0.30)' }}>
              {txMsg ?? 'Prediction locked — waiting for round to close…'}
            </div>
          </div>
        )}

        {/* ── NEEDS SETTLE: auto-settling in progress ── */}
        {ps === 'needsSettle' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] text-white/30 uppercase tracking-[.12em]">Round #{displayRoundId}</span>
              <span className="font-mono text-[10px] text-[#fbbf24] font-semibold tracking-[.06em]">CLOSED</span>
            </div>

            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-8 h-8 rounded-full border-2 border-[#6C2BF2] border-t-transparent animate-spin" />
              <div className="font-mono text-[12px] text-white/60 uppercase tracking-[.1em] text-center">
                {resolveStatus ?? 'Settling on-chain…'}
              </div>
              <div className="font-mono text-[10px] text-white/25 text-center">
                Recording final price &amp; revealing result
              </div>
            </div>

            {resolveError && (
              <div className="mt-3 font-mono text-[11px] text-red-400 leading-relaxed break-words text-center">
                {resolveError}
                <button onClick={handleSettle} disabled={isResolving}
                  className="block w-full mt-3 py-2.5 rounded-xl font-bold text-[12px] uppercase tracking-[.08em] text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #6C2BF2, #7c3af5)' }}>
                  Retry →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── RESULT ── (mini fallback; in gauntlet mode ChallengeView owns result UI) */}
        {!gauntletMode && (ps === 'result' || (ps === 'mResult' && !resultShown)) && (
          <div className="p-5">
            <div className="font-display font-black text-[26px] uppercase mb-1.5"
              style={{ color: resHumanWon ? '#10b981' : '#f43f5e',
                textShadow: `0 0 24px ${resHumanWon ? '#10b98155' : '#f43f5e55'}` }}>
              {resHumanWon ? '🏆 You Won!' : '😔 You Lost'}
            </div>

            <div className="font-mono text-[12px] text-white/50 mb-1">
              ETH went{' '}
              <span style={{ color: resOutcome === 'up' ? '#10b981' : '#f43f5e' }}>
                {resOutcome === 'up' ? '▲ higher' : '▼ lower'}
              </span>
              {resDelta ? ` by ${resDelta}` : ''}
            </div>
            <div className="font-mono text-[11px] text-white/30 mb-5">
              You: {displayHumanCall === 'up' ? '▲ Higher' : '▼ Lower'} ·{' '}
              AX-7: {displayAgentCall === 'up' ? '▲ Higher' : '▼ Lower'}
            </div>

            {isLive && txHash && (
              <a href={`https://sepolia.mantlescan.xyz/tx/${txHash}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-mono text-[10px] text-white/25 hover:text-white/50 uppercase tracking-[.08em] mb-4 transition-colors">
                ▦ View on Mantle ↗
              </a>
            )}

            <button
              onClick={isLive ? handlePlayAgain : resetMock}
              className="w-full py-3.5 rounded-xl font-mono font-bold text-[13px] uppercase tracking-[.08em] text-white transition-all active:scale-[.97]"
              style={{ background: 'linear-gradient(135deg, #6C2BF2, #7c3af5)',
                boxShadow: '0 0 28px rgba(108,43,242,0.50)' }}>
              ◼  New Round  →
            </button>
          </div>
        )}
      </div>

      {/* ── Settlement toast (bottom-right, shown only while modal not visible) ── */}
      {showToast && !resultShown && resOutcome !== null && displayHumanCall !== null && (
        <SettlementToast
          humanWon={resHumanWon}
          humanCall={displayHumanCall}
          agentCall={displayAgentCall ?? (resOutcome === 'up' ? 'down' : 'up')}
          outcome={resOutcome}
          deltaText={resDelta}
          txHash={isLive ? txHash : undefined}
          onDismiss={() => setShowToast(false)}
          onPlayAgain={isLive ? handlePlayAgain : resetMock}
        />
      )}

      {/* ── Full-screen result modal (Arena only — gauntlet uses ChallengeView) ── */}
      {!gauntletMode && resultShown && resOutcome !== null && displayHumanCall !== null && frozenResult && (
        <ResultModal
          verdict={resVerdict}
          humanCall={displayHumanCall}
          agentCall={displayAgentCall ?? null}
          outcome={resOutcome}
          startPrice={frozenResult.startPriceHuman}
          closePrice={frozenResult.closePriceHuman}
          roundId={frozenResult.roundId}
          txHash={isLive ? txHash : undefined}
          duration={displayTotal}
          onPlayAgain={handlePlayAgain}
        />
      )}
    </div>
  )
}
