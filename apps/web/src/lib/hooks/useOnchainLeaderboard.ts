'use client'

/**
 * useOnchainLeaderboard
 *
 * Strategy:
 *  1. getAllPlayers()           → address[]
 *  2. getAllAgentIds()          → bytes32[]
 *  3. getAgent(id) × n         → { wallet, name, active } (multicall)
 *  4. getPlayer(addr) × n      → { points, wins, losses, streak } (multicall)
 *  5. getAccuracy(addr) × n    → bps (multicall)
 *
 * All calls after step 1+2 are batched via wagmi useReadContracts (multicall3).
 * Falls back gracefully when contracts are not yet deployed.
 */

import { useReadContract, useReadContracts } from 'wagmi'
import { CONTRACTS } from '../contracts/addresses'
import { LEADERBOARD_ABI, AGENT_REGISTRY_ABI } from '../contracts/abis'
import { useMemo } from 'react'

const CONTRACTS_LIVE = CONTRACTS.RoundManager !== '0x0000000000000000000000000000000000000000'

export interface OnchainEntry {
  rank: number
  address: string
  type: 'human' | 'agent'
  initials: string
  name: string
  agentId?: string
  points: number
  wins: number
  losses: number
  streak: number
  accuracyBps: number   // basis points, 5000 = 50%
}

// ── Step 1: all player addresses ─────────────────────────────────────────────

export function useLeaderboardAddresses() {
  return useReadContract({
    address: CONTRACTS.Leaderboard as `0x${string}`,
    abi: LEADERBOARD_ABI,
    functionName: 'getAllPlayers',
    query: {
      enabled: CONTRACTS_LIVE,
      refetchInterval: 15_000,
    },
  })
}

// ── Step 2: all registered agent IDs ─────────────────────────────────────────

export function useAgentIds() {
  return useReadContract({
    address: CONTRACTS.AgentRegistry as `0x${string}`,
    abi: AGENT_REGISTRY_ABI,
    functionName: 'getAllAgentIds',
    query: {
      enabled: CONTRACTS_LIVE,
      refetchInterval: 60_000,  // agents don't change often
    },
  })
}

// ── Step 3: agent metadata for each agentId ──────────────────────────────────

export function useAgentDetails(agentIds: `0x${string}`[] | undefined) {
  const ids = agentIds ?? []

  return useReadContracts({
    contracts: ids.map((id) => ({
      address: CONTRACTS.AgentRegistry as `0x${string}`,
      abi: AGENT_REGISTRY_ABI,
      functionName: 'getAgent' as const,
      args: [id],
    })),
    query: {
      enabled: CONTRACTS_LIVE && ids.length > 0,
      refetchInterval: 60_000,
    },
  })
}

// ── Step 4+5: player stats + accuracy for all addresses ──────────────────────

export function usePlayersBatch(addresses: `0x${string}`[] | undefined) {
  const addrs = addresses ?? []

  const statsResult = useReadContracts({
    contracts: addrs.map((addr) => ({
      address: CONTRACTS.Leaderboard as `0x${string}`,
      abi: LEADERBOARD_ABI,
      functionName: 'getPlayer' as const,
      args: [addr],
    })),
    query: {
      enabled: CONTRACTS_LIVE && addrs.length > 0,
      refetchInterval: 10_000,
    },
  })

  const accuracyResult = useReadContracts({
    contracts: addrs.map((addr) => ({
      address: CONTRACTS.Leaderboard as `0x${string}`,
      abi: LEADERBOARD_ABI,
      functionName: 'getAccuracy' as const,
      args: [addr],
    })),
    query: {
      enabled: CONTRACTS_LIVE && addrs.length > 0,
      refetchInterval: 10_000,
    },
  })

  return { statsResult, accuracyResult }
}

// ── Composite hook ────────────────────────────────────────────────────────────

export function useOnchainLeaderboard(connectedAddress?: `0x${string}`) {
  const { data: addresses, isLoading: loadingAddrs } = useLeaderboardAddresses()
  const { data: agentIds, isLoading: loadingAgents } = useAgentIds()
  const { data: agentDetailsData } = useAgentDetails(agentIds as `0x${string}`[] | undefined)
  const { statsResult, accuracyResult } = usePlayersBatch(addresses as `0x${string}`[] | undefined)

  const isLoading = loadingAddrs || loadingAgents || statsResult.isLoading

  // Build a wallet → agent info map.
  // getAgent returns a struct decoded by viem as { wallet, erc8004IdentityId, name, active }
  const agentMap = useMemo<Map<string, { name: string; id: string }>>(() => {
    const m = new Map<string, { name: string; id: string }>()
    if (!agentIds || !agentDetailsData) return m
    agentIds.forEach((id, i) => {
      const result = agentDetailsData[i]
      if (result?.status !== 'success' || !result.result) return
      // viem decodes named tuple components as an object
      const agent = result.result as { wallet: `0x${string}`; name: string; active: boolean }
      if (agent.active) {
        m.set(agent.wallet.toLowerCase(), {
          name: agent.name || 'Agent',
          id: (id as string).slice(2, 10),
        })
      }
    })
    return m
  }, [agentIds, agentDetailsData])

  const entries = useMemo<OnchainEntry[]>(() => {
    if (!addresses || !statsResult.data) return []

    const addrs = addresses as `0x${string}`[]
    const stats = statsResult.data
    const accuracy = accuracyResult.data ?? []

    const rows: OnchainEntry[] = []

    addrs.forEach((addr, i) => {
      const stat = stats[i]
      const acc  = accuracy[i]
      if (stat?.status !== 'success' || !stat.result) return

      // getPlayer returns a struct decoded as { points, wins, losses, streak, bestStreak }
      const p = stat.result as { points: bigint; wins: bigint; losses: bigint; streak: bigint; bestStreak: bigint }
      const { points, wins, losses, streak } = p
      if (wins + losses === 0n) return  // skip addresses with no rounds played yet

      const agentInfo = agentMap.get(addr.toLowerCase())
      const isAgent   = !!agentInfo
      const isYou     = connectedAddress && addr.toLowerCase() === connectedAddress.toLowerCase()
      const shortAddr = addr.slice(0, 6) + '…' + addr.slice(-4)

      const accBps = acc?.status === 'success' && acc.result != null
        ? Number(acc.result as bigint)
        : 0

      rows.push({
        rank: 0,  // filled after sort
        address: addr,
        type: isAgent ? 'agent' : 'human',
        initials: isAgent
          ? agentInfo!.name.slice(0, 2).toUpperCase()
          : isYou ? 'YO' : shortAddr.slice(2, 4).toUpperCase(),
        name:   isAgent ? agentInfo!.name : isYou ? 'You' : shortAddr,
        agentId: isAgent ? agentInfo!.id : undefined,
        points:      Number(points),
        wins:        Number(wins),
        losses:      Number(losses),
        streak:      Number(streak),
        accuracyBps: accBps,
      })
    })

    rows.sort((a, b) => b.points - a.points)
    rows.forEach((r, i) => { r.rank = i + 1 })
    return rows
  }, [addresses, statsResult.data, accuracyResult.data, agentMap, connectedAddress])

  return { entries, isLoading, contractsLive: CONTRACTS_LIVE }
}
