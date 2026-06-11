import dynamic from 'next/dynamic'

export const metadata = { title: 'Arena — Klyro' }

const ArenaView = dynamic(
  () => import('@/components/arena/ArenaView').then((m) => m.ArenaView),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center"
        style={{ height: 'calc(100dvh - 64px)', background: '#02040A' }}>
        <div className="w-6 h-6 rounded-full border-2 border-[#6C2BF2] border-t-transparent animate-spin" />
      </div>
    ),
  }
)

export default function ArenaPage() {
  return <ArenaView />
}
