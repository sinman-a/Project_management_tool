import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useProjectEVM } from '@/hooks/useBaselines'
import type { EVMResult } from '@/types'

const BAND_CLS: Record<string, string> = {
  green: 'text-green-600 bg-green-50',
  amber: 'text-amber-600 bg-amber-50',
  red: 'text-red-600 bg-red-50',
}

function formatEur(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : n > 0 ? '+' : ''
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return `${sign}${abs.toFixed(0)}`
}

function Tile({ label, value, band, subtitle }: {
  label: string; value: string; band: 'green' | 'amber' | 'red'; subtitle?: string
}) {
  const cls = BAND_CLS[band]
  const Icon = band === 'green' ? TrendingUp : band === 'red' ? TrendingDown : Minus
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${cls}`}>
            <Icon className="w-3 h-3 inline mr-0.5" />{band}
          </span>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

interface Props {
  projectId: string
}

export function EVMTiles({ projectId }: Props) {
  const { data: evm, isLoading } = useProjectEVM(projectId)

  if (isLoading) return null
  if (!evm || !evm.hasBaseline) return null

  const evmData = evm as EVMResult

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Tile
        label="SV"
        value={formatEur(evmData.sv)}
        band={evmData.sv >= 0 ? 'green' : evmData.sv >= -evmData.pv * 0.15 ? 'amber' : 'red'}
        subtitle={`EV ${formatEur(evmData.ev)} - PV ${formatEur(evmData.pv)}`}
      />
      <Tile
        label="CV"
        value={formatEur(evmData.cv)}
        band={evmData.cv >= 0 ? 'green' : evmData.cv >= -evmData.ac * 0.15 ? 'amber' : 'red'}
        subtitle={`EV ${formatEur(evmData.ev)} - AC ${formatEur(evmData.ac)}`}
      />
      <Tile
        label="SPI"
        value={evmData.spi.toFixed(2)}
        band={evmData.band}
        subtitle="Schedule Performance"
      />
      <Tile
        label="CPI"
        value={evmData.cpi.toFixed(2)}
        band={evmData.band}
        subtitle="Cost Performance"
      />
    </div>
  )
}
