import { cn } from '@/lib/utils'
import type { RiskHeatmapCell } from '@/types'

const CELL_BG = (score: number) => {
  if (score <= 6) return 'bg-green-100 hover:bg-green-200'
  if (score <= 14) return 'bg-yellow-100 hover:bg-yellow-200'
  if (score <= 20) return 'bg-orange-200 hover:bg-orange-300'
  return 'bg-red-200 hover:bg-red-300'
}

interface Props {
  cells: RiskHeatmapCell[]
  selectedP?: number
  selectedI?: number
  onSelect?: (p: number, i: number) => void
}

export function RiskHeatmap({ cells, selectedP, selectedI, onSelect }: Props) {
  const countMap = new Map(cells.map((c) => [`${c.probability}:${c.impact}`, c.count]))

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
        <span className="w-6 text-center font-medium">P↑</span>
        <span className="flex-1 text-center">Impact →</span>
      </div>
      {[5, 4, 3, 2, 1].map((p) => (
        <div key={p} className="flex items-center gap-1">
          <span className="w-6 text-xs text-muted-foreground text-center font-medium">{p}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => {
              const count = countMap.get(`${p}:${i}`) ?? 0
              const score = p * i
              const isSelected = selectedP === p && selectedI === i
              return (
                <button
                  key={i}
                  type="button"
                  className={cn(
                    'w-10 h-10 rounded text-xs font-medium transition-all flex items-center justify-center',
                    CELL_BG(score),
                    isSelected && 'ring-2 ring-primary ring-offset-1',
                    'focus:outline-none focus:ring-2 focus:ring-primary',
                  )}
                  onClick={() => onSelect?.(p, i)}
                  title={`P${p}×I${i} = ${score} | ${count} risk${count !== 1 ? 's' : ''}`}
                  aria-label={`Probability ${p}, Impact ${i}, score ${score}, ${count} risks`}
                >
                  {count > 0 ? (
                    <span className={cn('rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold', score > 14 ? 'bg-white/60' : 'bg-black/10')}>
                      {count}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-1 mt-1 ml-7">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="w-10 text-center text-xs text-muted-foreground">{i}</span>
        ))}
      </div>
    </div>
  )
}
