'use client'

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { CONTRACTS } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'

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

export function useLockPrediction() {
  const { writeContractAsync, isPending, error, data: txHash } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  })

  async function lockPrediction(roundId: bigint, isUp: boolean) {
    return writeContractAsync({
      address: CONTRACTS.RoundManager as `0x${string}`,
      abi: ROUND_MANAGER_ABI,
      functionName: 'lockPrediction',
      args: [roundId, isUp],
    })
  }

  return {
    lockPrediction,
    isPending,
    isConfirming,
    isConfirmed,
    txHash,
    error,
  }
}
