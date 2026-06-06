'use client'

// TODO (Phase A): implement with wagmi useReadContract / useWriteContract

export function useRound(_roundId: string | null) {
  return {
    round: null,
    isLoading: false,
    error: null,
  }
}

export function useLockPrediction() {
  return {
    lockPrediction: async (_roundId: bigint, _isUp: boolean) => {
      // TODO: wagmi writeContract call to RoundManager.lockPrediction
      throw new Error('Not implemented')
    },
    isPending: false,
    error: null,
  }
}
