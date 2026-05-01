import { cn } from '@/lib/utils'
import type { RagStatus } from '@/types'

interface RagDotProps {
  status: RagStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' }
const colorMap = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
}

export function RagDot({ status, size = 'md', className }: RagDotProps) {
  return (
    <span
      className={cn('inline-block rounded-full flex-shrink-0', sizeMap[size], colorMap[status], className)}
      aria-label={`Status: ${status}`}
    />
  )
}
