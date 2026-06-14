/**
 * ensureGas — make sure a freshly-connected wallet can pay for its on-chain
 * transactions. Calls /api/gas-drip, which tops up near-empty wallets with a
 * little MNT (and skips wallets that already have funds).
 *
 * The route awaits its own tx receipt, so when this promise resolves the funds
 * have (very likely) landed. Safe to call repeatedly — the server balance-checks.
 */
export async function ensureGas(address: string | undefined | null): Promise<void> {
  if (!address) return
  try {
    await fetch('/api/gas-drip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
  } catch {
    // Non-fatal: if the drip fails the user can still fund via faucet.
  }
}
