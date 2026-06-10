import { CalendarClock, TrendingUp, TrendingDown, Gauge, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useProjectForecast } from '@/hooks/useAnalytics'

interface Props {
  projectId: string
}

function varianceLabel(days: number | null): { text: string; cls: string } {
  if (days == null) return { text: '—', cls: '' }
  if (days <= 0) return { text: `${days === 0 ? 'on track' : `${Math.abs(days)}d early`}`, cls: 'text-green-600' }
  return { text: `${days}d late`, cls: 'text-red-600' }
}

export function ForecastCard({ projectId }: Props) {
  const { data: forecast, isLoading } = useProjectForecast(projectId)

  if (isLoading || !forecast) return null

  if (!forecast.hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            <CalendarClock className="inline-block w-4 h-4 mr-2 text-primary" /> Completion Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Insufficient data — add task dates/estimates (and lock a baseline) to forecast the finish date.
          </p>
        </CardContent>
      </Card>
    )
  }

  const variance = varianceLabel(forecast.scheduleVarianceDays)
  const slipping = (forecast.scheduleVarianceDays ?? 0) > 0
  const spi = forecast.spi

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          <CalendarClock className="inline-block w-4 h-4 mr-2 text-primary" /> Completion Forecast
        </CardTitle>
        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
          {forecast.confidence} confidence
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Planned finish</p>
            <p className="text-lg font-semibold tabular-nums">{forecast.plannedFinish ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Forecast finish</p>
            <p className={cn('text-lg font-semibold tabular-nums flex items-center gap-1', slipping ? 'text-red-600' : 'text-green-600')}>
              {slipping ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {forecast.forecastFinish ?? '—'}
            </p>
            <p className={cn('text-xs mt-0.5', variance.cls)}>{variance.text}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              <Gauge className="inline w-3 h-3 mr-0.5" /> SPI
            </p>
            <p className={cn('text-lg font-semibold tabular-nums',
              spi == null ? '' : spi >= 0.95 ? 'text-green-600' : spi >= 0.85 ? 'text-amber-600' : 'text-red-600')}>
              {spi != null ? spi.toFixed(2) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              <Zap className="inline w-3 h-3 mr-0.5" /> Velocity
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {forecast.velocityPtsPerWeek != null ? `${forecast.velocityPtsPerWeek.toFixed(1)}` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">pts / week</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
