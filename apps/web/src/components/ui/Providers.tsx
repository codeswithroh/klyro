'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ThirdwebProvider } from 'thirdweb/react'
import { useState } from 'react'
import { wagmiConfig } from '@/lib/contracts/wagmi-config'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 4_000,     // 4s — price data refreshes frequently
        refetchInterval: 5_000,
      },
    },
  }))

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ThirdwebProvider>
          {children}
        </ThirdwebProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
