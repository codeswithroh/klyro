'use client'

import { cn } from '@/lib/utils/cn'

interface WordmarkProps {
  size?: number
  className?: string
}

export function Wordmark({ size = 22, className }: WordmarkProps) {
  const ringSize = size * 0.78

  return (
    <span
      className={cn('wordmark', className)}
      style={{ fontSize: size }}
    >
      KLYR
      <span
        className="wm-ring"
        style={{ width: ringSize, height: ringSize, margin: '0 0.01em' }}
      >
        <i />
      </span>
    </span>
  )
}
