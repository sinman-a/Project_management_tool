import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

/** Small accessible info icon that reveals an explanatory tooltip on hover/focus. */
export function InfoTooltip({ content, className }: { content: ReactNode; className?: string }) {
  return (
    <span className={`relative inline-flex group align-middle ${className ?? ''}`}>
      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help outline-none" tabIndex={0} aria-label="More info" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-72 rounded-md border bg-popover text-popover-foreground text-xs leading-relaxed p-2.5 shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50"
      >
        {content}
      </span>
    </span>
  )
}
