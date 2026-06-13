'use client'

/**
 * useSubmitGauntletScore
 *
 * Submits a completed Gauntlet match result to GauntletLeaderboard.sol on
 * Mantle Sepolia. One transaction per match — fires at the end of the series.
 *
 * The contract is self-reported (no onlyRoundManager gate) so users call it
 * directly from their own wallet. Gas is trivial on Mantle Sepolia (~<$0.001).
 */

import { useState } from 'react'
import { sendTransaction, prepareContractCall, getContract, waitForReceipt } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { defineChain } from 'thirdweb'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS } from '../contracts/addresses'
import { GAUNTLET_LEADERBOARD_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

export type SubmitStatus = 'idle' | 'pending' | 'confirming' | 'confirmed' | 'error'

export function useSubmitGauntletScore() {
  const account = useActiveAccount()
  const [status, setStatus]   = useState<SubmitStatus>('idle')
  const [txHash, setTxHash]   = useState<`0x${string}` | null>(null)
  const [error,  setError]    = useState<string | null>(null)

  async function submitScore(params: {
    wins:         number
    losses:       number
    totalRounds:  number  // 3 or 5
    durationSecs: number  // 15 | 30 | 45 | 60
  }) {
    if (!account) { setError('Connect your wallet first'); return }

    const contractAddr = CONTRACTS.GauntletLeaderboard
    if (contractAddr === '0x0000000000000000000000000000000000000000') {
      setError('GauntletLeaderboard contract not configured')
      return
    }

    setStatus('pending')
    setError(null)
    setTxHash(null)

    try {
      const contract = getContract({
        client:  thirdwebClient,
        chain:   twChain,
        address: contractAddr as `0x${string}`,
        abi:     GAUNTLET_LEADERBOARD_ABI as any,
      })

      const tx = prepareContractCall({
        contract,
        method: 'function submitResult(uint8 wins, uint8 losses, uint8 totalRounds, uint16 durationSecs)',
        params: [
          params.wins,
          params.losses,
          params.totalRounds,
          params.durationSecs,
        ],
      })

      setStatus('confirming')
      const result = await sendTransaction({ transaction: tx, account })
      const hash = (result as any)?.transactionHash ?? null
      setTxHash(hash)

      // Wait for on-chain confirmation
      if (hash) {
        await waitForReceipt({ transactionHash: hash, client: thirdwebClient, chain: twChain })
      }

      setStatus('confirmed')
    } catch (e) {
      const msg = (e as Error).message ?? 'Transaction failed'
      setError(msg.slice(0, 150))
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setTxHash(null)
    setError(null)
  }

  return { submitScore, status, txHash, error, reset }
}
