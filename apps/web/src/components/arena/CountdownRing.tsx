'use client'

const CIRCUMFERENCE = 2 * Math.PI * 52 // r=52

interface CountdownRingProps {
  seconds: number
  total: number
  size?: number
}

export function CountdownRing({ seconds, total, size = 116 }: CountdownRingProps) {
  const progress = seconds / total
  const offset = CIRCUMFERENCE * (1 - progress)

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 116 116"
        width={size}
        height={size}
        className="absolute inset-0"
        aria-hidden="true"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <circle cx="58" cy="58" r="52" fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="58" cy="58" r="52" fill="none"
          stroke="var(--sig)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s linear' }}
        />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="font-display font-black text-[38px] tracking-[-0.04em] leading-none">{seconds}</span>
        <span className="font-mono text-[10px] text-ink-3 uppercase tracking-[.18em]">seconds</span>
      </div>
    </div>
  )
}
