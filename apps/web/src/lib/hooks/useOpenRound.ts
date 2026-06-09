'use client'

/**
 * useOpenRound — opens a round via RoundManager.openRound.
 *
 * Pyth's own price pusher keeps the on-chain feed fresh on Mantle Sepolia,
 * so openRound (reads stored price) works reliably. openRoundWithPrice
 * (pushes VAA + opens) consistently reverts because our VAA is never
 * newer than what Pyth already has stored.
 */

import { useState } from 'react'
import { sendTransaction, prepareContractCall, getContract } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { defineChain } from 'thirdweb'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS, PRICE_FEEDS, type AssetPair } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})


export function useOpenRound() {
  const account = useActiveAccount()
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function openRound(asset: AssetPair = 'ETH/USD', durationSeconds = 60) {
    if (!account) { setError('Connect your wallet first'); return }
    setIsOpening(true)
    setError(null)

    try {
      const feedId = PRICE_FEEDS[asset]

      const rmContract = getContract({
        client: thirdwebClient,
        chain: twChain,
        address: CONTRACTS.RoundManager as `0x${string}`,
        abi: ROUND_MANAGER_ABI as any,
      })

      // openRoundWithPrice is unreliable on Mantle Sepolia — Pyth's own pusher
      // keeps the on-chain price fresh, so our VAA is always rejected as stale.
      // Call openRound directly which reads the already-stored Pyth price.
      setStatus('Opening round…')
      const openTx = prepareContractCall({
        contract: rmContract,
        method: 'function openRound(bytes32 priceFeedId, uint256 durationSeconds) returns (uint256 roundId)',
        params: [feedId as `0x${string}`, BigInt(durationSeconds)],
      })
      await sendTransaction({ transaction: openTx, account })
      setStatus(null)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('0x19abf40e') || msg.toLowerCase().includes('staleprice')) {
        setError('Price feed stale — try again in a moment')
      } else {
        setError(msg.slice(0, 120) ?? 'Unknown error')
      }
      setStatus(null)
    } finally {
      setIsOpening(false)
    }
  }

  return { openRound, isOpening, status, error }
}
