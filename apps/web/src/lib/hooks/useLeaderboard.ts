'use client'

import { useReadContract } from 'wagmi'
import { CONTRACTS } from '../contracts/addresses'
import { LEADERBOARD_ABI } from '../contracts/abis'
import { useCallback } from 'react'

export function useLeaderboardPlayers() {
  return useReadContract({
    address: CONTRACTS.Leaderboard as `0x${string}`,
    abi: LEADERBOARD_ABI,
    functionName: 'getAllPlayers',
    query: {
      enabled: CONTRACTS.Leaderboard !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 10_000,
    },
  })
}

export function usePlayerStats(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.Leaderboard as `0x${string}`,
    abi: LEADERBOARD_ABI,
    functionName: 'getPlayer',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && CONTRACTS.Leaderboard !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 5_000,
    },
  })
}

export function usePlayerAccuracy(address: `0x${string}` | undefined) {
  return useReadContract({
    address: CONTRACTS.Leaderboard as `0x${string}`,
    abi: LEADERBOARD_ABI,
    functionName: 'getAccuracy',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10_000,
    },
  })
}
