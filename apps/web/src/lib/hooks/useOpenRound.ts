'use client'

/**
 * useOpenRound — opens a round via RoundManager.openRoundWithPrice.
 *
 * Price oracle: MockPyth (deployed 2026-06-13 at NEXT_PUBLIC_PYTH_ADDRESS).
 * The real Pyth v32 on Mantle Sepolia doesn't support the new accumulator
 * format (PNAU) emitted by Hermes. We use MockPyth instead, which accepts
 * a simple abi.encode(bytes32 feedId, int64 price, uint64 conf, int32 expo)
 * per updateData element.
 *
 * Flow:
 *   1. Fetch live price (see ../priceFeed — Hermes now requires a paid API
 *      key, so this sources from free exchange APIs instead)
 *   2. abi.encode into MockPyth's updateData format
 *   3. Call openRoundWithPrice(updateData, feedId, duration, {value: 0})
 *   4. waitForReceipt — throws on revert so the caller's catch fires
 */

import { useState } from 'react'
import { sendTransaction, prepareContractCall, getContract, waitForReceipt } from 'thirdweb'
import { useActiveAccount } from 'thirdweb/react'
import { defineChain } from 'thirdweb'
import { encodeAbiParameters, parseAbiParameters } from 'viem'
import { thirdwebClient } from '../contracts/thirdweb-client'
import { CONTRACTS, PRICE_FEEDS, type AssetPair } from '../contracts/addresses'
import { ROUND_MANAGER_ABI } from '../contracts/abis'
import { mantleSepolia } from '../contracts/chain'
import { fetchLivePrice, type LivePrice } from '../priceFeed'

const twChain = defineChain({
  id: mantleSepolia.id,
  rpc: mantleSepolia.rpcUrls.default.http[0],
  nativeCurrency: mantleSepolia.nativeCurrency,
})

/**
 * Encode price data in MockPyth's format:
 *   abi.encode(bytes32 feedId, int64 price, uint64 conf, int32 expo)
 */
function encodeMockPythUpdate(feedId: string, price: LivePrice): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters('bytes32, int64, uint64, int32'),
    [
      feedId as `0x${string}`,
      price.rawPrice,
      price.conf,
      price.expo,
    ],
  )
}

export function useOpenRound() {
  const account = useActiveAccount()
  const [isOpening, setIsOpening] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  async function openRound(asset: AssetPair = 'ETH/USD', durationSeconds = 60) {
    if (!account) { setError('Connect your wallet first'); return }
    setIsOpening(true)
    setError(null)

    try {
      const feedId = PRICE_FEEDS[asset]

      // 1. Fetch live price
      setStatus('Fetching live price…')
      const livePrice = await fetchLivePrice(feedId)

      // 2. Encode as MockPyth update (no VAA needed)
      const updateData = [encodeMockPythUpdate(feedId, livePrice)]

      // 3. Call openRoundWithPrice — fee is 0 on MockPyth
      const rmContract = getContract({
        client: thirdwebClient,
        chain:  twChain,
        address: CONTRACTS.RoundManager as `0x${string}`,
        abi: ROUND_MANAGER_ABI as any,
      })

      setStatus('Opening round on-chain…')
      const openTx = prepareContractCall({
        contract: rmContract,
        method: 'function openRoundWithPrice(bytes[] updateData, bytes32 priceFeedId, uint256 durationSeconds) payable returns (uint256 roundId)',
        params: [updateData, feedId as `0x${string}`, BigInt(durationSeconds)],
        value: 0n,  // MockPyth fee is 0
      })

      const result = await sendTransaction({ transaction: openTx, account })
      const hash = (result as any)?.transactionHash as `0x${string}` | undefined

      if (hash) {
        setStatus('Confirming on Mantle…')
        const receipt = await waitForReceipt({
          transactionHash: hash,
          client: thirdwebClient,
          chain: twChain,
        })
        if (receipt.status === 'reverted') {
          throw new Error('Transaction reverted on-chain')
        }
      }

      setStatus(null)
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg.toLowerCase().includes('binance') || msg.toLowerCase().includes('coingecko') || msg.toLowerCase().includes('price feed')) {
        setError('Could not fetch live price — check connection and retry')
      } else if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
        setError('Transaction cancelled')
      } else if (msg.toLowerCase().includes('reverted')) {
        setError('Transaction reverted — try again')
      } else {
        setError(msg.slice(0, 120) || 'Transaction failed')
      }
      setStatus(null)
      throw e  // re-throw so ArenaView catch clears waitingOpen
    } finally {
      setIsOpening(false)
    }
  }

  return { openRound, isOpening, status, error }
}
