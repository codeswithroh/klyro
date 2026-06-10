'use client'

/**
 * useChainRound
 *
 * Finds the currently open round on-chain:
 *  1. Read nextRoundId from RoundManager
 *  2. Check roundId = nextRoundId - 1 (the last opened round)
 *  3. If resolved or not open, round is done — show "waiting for next round"
 *
 * Returns the round data and a live secondsLeft derived from closeTime.
 */

import { useReadContract } from 'wagmi'
import { useEffect, useState } from 'react'
import { CONTRACTS } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'

export const CONTRACTS_LIVE = CONTRACTS.RoundManager !== '0x0000000000000000000000000000000000000000'

export interface ChainRound {
  roundId: bigint
  priceFeedId: `0x${string}`
  startPrice: bigint      // raw int64 from oracle
  closePrice: bigint
  startTime: bigint
  closeTime: bigint
  resolved: boolean
  outcome: boolean        // true = price went UP
  isOpen: boolean
  secondsLeft: number     // live countdown derived from closeTime
  totalDuration: number   // closeTime - startTime
  startPriceHuman: number // human-readable price (startPrice / 1e8)
}

// Converts raw Pyth int64 (expo=-8) to human price
function rawToHuman(raw: bigint): number {
  return Number(raw) / 1e8
}

export function useChainRound() {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))

  // Keep a live clock
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Math.floor(Date.now() / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Step 1: get next round ID
  const { data: nextRoundId, isLoading: loadingId } = useReadContract({
    address: CONTRACTS.RoundManager as `0x${string}`,
    abi: ROUND_MANAGER_ABI,
    functionName: 'nextRoundId',
    query: {
      enabled: CONTRACTS_LIVE,
      refetchInterval: 5_000,
    },
  })

  const currentRoundId = nextRoundId && (nextRoundId as bigint) > 1n
    ? (nextRoundId as bigint) - 1n
    : null

  // Step 2: get round data
  const { data: roundData, isLoading: loadingRound } = useReadContract({
    address: CONTRACTS.RoundManager as `0x${string}`,
    abi: ROUND_MANAGER_ABI,
    functionName: 'getRound',
    args: currentRoundId !== null ? [currentRoundId] : undefined,
    query: {
      enabled: CONTRACTS_LIVE && currentRoundId !== null,
      refetchInterval: 3_000,
    },
  })

  const round = roundData as {
    priceFeedId: `0x${string}`
    startPrice: bigint
    closePrice: bigint
    startTime: bigint
    closeTime: bigint
    resolved: boolean
    outcome: boolean
  } | undefined

  const isOpen = round
    ? !round.resolved && now < Number(round.closeTime)
    : false

  const sLeft = round
    ? Math.max(0, Number(round.closeTime) - now)
    : 0

  // Derived result
  const chainRound: ChainRound | null = round && currentRoundId !== null
    ? {
        roundId: currentRoundId,
        priceFeedId: round.priceFeedId,
        startPrice: round.startPrice,
        closePrice: round.closePrice,
        startTime: round.startTime,
        closeTime: round.closeTime,
        resolved: round.resolved,
        outcome: round.outcome,
        isOpen,
        secondsLeft: sLeft,
        totalDuration: round ? Math.max(15, Number(round.closeTime) - Number(round.startTime)) : 60,
        startPriceHuman: rawToHuman(round.startPrice),
      }
    : null

  return {
    chainRound,
    isLoading: loadingId || loadingRound,
    contractsLive: CONTRACTS_LIVE,
  }
}
