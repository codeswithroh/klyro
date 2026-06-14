'use client'

/**
 * FaucetButton — a quiet, fixed corner link to the Mantle testnet faucet.
 *
 * Pattern borrowed from how most testnet dapps surface a faucet: a small,
 * low-attention pill anchored to a corner, out of the main flow but easy to
 * find when a wallet needs gas. Icon is a droplet, the universal faucet glyph.
 */
export function FaucetButton() {
  return (
    <a
      href="https://faucet.mantle.xyz/"
      target="_blank"
      rel="noopener noreferrer"
      title="Get free testnet MNT from the Mantle faucet"
      aria-label="Get free testnet MNT"
      className="group fixed bottom-4 left-4 z-30 flex items-center gap-2 rounded-full py-2 pl-2.5 pr-3 shadow-sm backdrop-blur transition-all hover:shadow-md hover:-translate-y-px"
      style={{
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        border: '1px solid var(--line-2)',
      }}
    >
      <svg
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="transition-colors"
        style={{ color: 'var(--sig)' }}
      >
        <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
      </svg>
      <span
        className="font-mono text-[11px] tracking-[.06em] uppercase transition-colors"
        style={{ color: 'var(--ink-3)' }}
      >
        Faucet
      </span>
    </a>
  )
}
