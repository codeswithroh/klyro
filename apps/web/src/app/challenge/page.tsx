import dynamic from 'next/dynamic'

export const metadata = {
  title: 'Gauntlet — Klyro',
  description: 'Multi-round challenge mode. Best of 3 or 5 rounds — Human vs Axiom-7 AI on Mantle.',
}

const ChallengeView = dynamic(
  () => import('@/components/challenge/ChallengeView').then((m) => m.ChallengeView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-screen"
        style={{ background: 'var(--paper)' }}>
        <div className="w-6 h-6 rounded-full border-2 border-[#6C2BF2] border-t-transparent animate-spin" />
      </div>
    ),
  }
)

export default function ChallengePage() {
  return <ChallengeView />
}
