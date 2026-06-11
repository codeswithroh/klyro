import dynamic from 'next/dynamic'

export const metadata = { title: 'Leaderboard — Klyro' }

// LeaderboardView uses wallet hooks + on-chain reads — all client-side.
// No server-side data fetching here, so force-dynamic is not needed.
const LeaderboardView = dynamic(
  () => import('@/components/leaderboard/LeaderboardView').then((m) => m.LeaderboardView),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-paper py-16 px-4">
        <div className="max-w-[860px] mx-auto">
          <div className="h-4 w-40 bg-paper-2 rounded animate-pulse mb-4" />
          <div className="h-10 w-56 bg-paper-2 rounded animate-pulse mb-8" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-paper-2 rounded animate-pulse mb-2" />
          ))}
        </div>
      </div>
    ),
  }
)

export default function LeaderboardPage() {
  return <LeaderboardView />
}
