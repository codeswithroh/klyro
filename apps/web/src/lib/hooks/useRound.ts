'use client'

/**
 * useRound — contract reads (wagmi) + contract writes (thirdweb).
 *
 * Reads use wagmi's useReadContract (just RPC calls, no wallet needed).
 * Writes use thirdweb's useSendTransaction because thirdweb manages
 * the connected wallet — wagmi has no connectors set up, so
 * useWriteContract would silently have no account.
 */

import { useReadContract } from 'wagmi'
import { useSendTransaction, useActiveAccount } from 'thirdweb/react'
import { prepareContractCall, getContract } from 'thirdweb'
import { defineChain } from 'thirdweb'
import { useState } from 'react'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

// ── Reads (wagmi) ──────────────────────────────────────────────────────────────

export function useActiveRound(roundId: bigint | null) {
  return useReadContract({
    address: CONTRACTS.RoundManager as `0x${string}`,
    abi: ROUND_MANAGER_ABI,
    functionName: 'getRound',
    args: roundId !== null ? [roundId] : undefined,
    query: {
      enabled: roundId !== null && CONTRACTS.RoundManager !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 2_000,
    },
  })
}

export function useIsRoundOpen(roundId: bigint | null) {
  return useReadContract({
    address: CONTRACTS.RoundManager as `0x${string}`,
    abi: ROUND_MANAGER_ABI,
    functionName: 'isRoundOpen',
    args: roundId !== null ? [roundId] : undefined,
    query: {
      enabled: roundId !== null && CONTRACTS.RoundManager !== '0x0000000000000000000000000000000000000000',
      refetchInterval: 2_000,
    },
  })
}

// ── Writes (thirdweb) ─────────────────────────────────────────────────────────

export function useLockPrediction() {
  const account = useActiveAccount()
  const { mutateAsync: sendTx, isPending } = useSendTransaction()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [isConfirming, setIsConfirming] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  async function lockPrediction(roundId: bigint, isUp: boolean) {
    if (!account) throw new Error('No wallet connected')
    setError(null)
    setIsConfirming(false)
    setIsConfirmed(false)

    const contract = getContract({
      client: thirdwebClient,
      chain: twChain,
      address: CONTRACTS.RoundManager as `0x${string}`,
      abi: ROUND_MANAGER_ABI as any,
    })

    const tx = prepareContractCall({
      contract,
      method: 'function lockPrediction(uint256 roundId, bool isUp)',
      params: [roundId, isUp],
    })

    try {
      setIsConfirming(true)
      const receipt = await sendTx(tx)
      const hash = (receipt as any)?.transactionHash ?? undefined
      setTxHash(hash)
      setIsConfirmed(true)
      return hash
    } catch (e) {
      setError(e as Error)
      throw e
    } finally {
      setIsConfirming(false)
    }
  }

  return { lockPrediction, isPending, isConfirming, isConfirmed, txHash, error }
}
