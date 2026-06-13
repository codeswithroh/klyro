'use client'

/**
 * useOpenRound — opens a round via RoundManager.openRound.
 *
 * Pyth's own price pusher keeps the on-chain feed fresh on Mantle Sepolia,
 * so openRound (reads stored price) works reliably. openRoundWithPrice
 * (pushes VAA + opens) consistently reverts because our VAA is never
 * newer than what Pyth already has stored.
 *
 * IMPORTANT: we call waitForReceipt after sendTransaction so that
 * on-chain reverts surface as thrown errors. Without it, sendTransaction
 * resolves as soon as the tx hits the mempool — reverts are invisible,
 * and the UI hangs on the "Opening round…" spinner forever.
 */

import { useState } from 'react'
import { sendTransaction, prepareContractCall, getContract, waitForReceipt } from 'thirdweb'
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

      setStatus('Sending transaction…')
      const openTx = prepareContractCall({
        contract: rmContract,
        method: 'function openRound(bytes32 priceFeedId, uint256 durationSeconds) returns (uint256 roundId)',
        params: [feedId as `0x${string}`, BigInt(durationSeconds)],
      })

      // sendTransaction resolves at mempool submission — NOT confirmation.
      // We must waitForReceipt so reverts are thrown and the caller's catch block fires.
      const result = await sendTransaction({ transaction: openTx, account })
      const hash = (result as any)?.transactionHash as `0x${string}` | undefined

      if (hash) {
        setStatus('Confirming on Mantle…')
        const receipt = await waitForReceipt({
          transactionHash: hash,
          client: thirdwebClient,
          chain: twChain,
        })
        // status 0 = reverted
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted on-chain')
        }
      }

      setStatus(null)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg.includes('0x19abf40e') || msg.toLowerCase().includes('staleprice')) {
        setError('Price feed stale — try again in a moment')
      } else if (msg.toLowerCase().includes('reverted')) {
        setError('Transaction reverted — price may be stale, try again')
      } else {
        setError(msg.slice(0, 120) || 'Transaction failed')
      }
      setStatus(null)
      throw e  // re-throw so handleStartRound's catch fires and clears waitingOpen
    } finally {
      setIsOpening(false)
    }
  }

  return { openRound, isOpening, status, error }
}
