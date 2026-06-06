import { createConfig, http } from 'wagmi'
import { mantleSepolia } from './chain'

export const wagmiConfig = createConfig({
  chains: [mantleSepolia],
  transports: {
    [mantleSepolia.id]: http(
      process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC ?? 'https://rpc.sepolia.mantle.xyz'
    ),
  },
  // Wallet connections are handled by thirdweb; no connectors needed here
  // (thirdweb injects the connected wallet into the wagmi context via its provider)
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
