import dynamic from 'next/dynamic'

export const metadata = {
  title: 'Daily Challenge — Beat Axiom-7 | Klyro',
  description: 'One challenge a day against the AI. Same matchup for everyone. Build your streak — no wallet required.',
}

const DailyChallengeView = dynamic(
  () => import('@/components/challenge/DailyChallengeView').then((m) => m.DailyChallengeView),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sig border-t-transparent animate-spin" />
      </div>
    ),
  }
)

export default function DailyPage() {
  return <DailyChallengeView />
}
