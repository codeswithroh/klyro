import dynamic from 'next/dynamic'

export const metadata = {
  title: 'Live Benchmark — Human vs AI on Mantle | Klyro',
  description: 'The Turing Test, settled on-chain. A live, verifiable Human-vs-AI prediction benchmark. Every round is permanently recorded on Mantle and scored against the real Pyth price.',
}

const BenchmarkView = dynamic(
  () => import('@/components/agent/BenchmarkView').then((m) => m.BenchmarkView),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-paper py-14 px-4">
        <div className="max-w-[640px] mx-auto">
          <div className="h-6 w-44 bg-paper-2 rounded-full animate-pulse mb-6" />
          <div className="h-9 w-full bg-paper-2 rounded animate-pulse mb-3" />
          <div className="h-4 w-3/4 bg-paper-2 rounded animate-pulse mb-8" />
          <div className="h-64 bg-paper-2 rounded-2xl animate-pulse mb-5" />
          <div className="grid grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-paper-2 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    ),
  }
)

export default function BenchmarkPage() {
  return <BenchmarkView />
}
