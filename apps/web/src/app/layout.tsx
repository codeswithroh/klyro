import type { Metadata, Viewport } from 'next'
import '../styles/globals.css'
import { Providers } from '@/components/ui/Providers'
import { Nav } from '@/components/ui/Nav'

export const metadata: Metadata = {
  title: 'Klyro — Out-predict the machine',
  description:
    'A fast, social price-prediction arena where humans go head-to-head against AI agents. Every call settled fairly and verifiably on-chain.',
  openGraph: {
    title: 'Klyro — Out-predict the machine',
    description: 'Call it UP. Call it DOWN. Beat the AI.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Klyro — Out-predict the machine',
    description: 'Call it UP. Call it DOWN. Beat the AI.',
    images: ['/og.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#6C2BF2',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  )
}
