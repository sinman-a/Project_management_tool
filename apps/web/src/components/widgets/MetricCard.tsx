import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  className?: string
  valueColor?: 'default' | 'green' | 'amber' | 'red'
}

const valueColorMap = {
  default: '',
  green: 'text-green-600',
  amber: 'text-amber-600',
  red: 'text-red-600',
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  className,
  valueColor = 'default',
}: MetricCardProps) {
  return (
    <Card className={cn('min-w-[160px]', className)}>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
        <p className={cn('text-2xl font-bold mt-1', valueColorMap[valueColor])}>{value}</p>
        {(subtitle || trend) && (
          <div className="flex items-center gap-1 mt-1">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
            {trend === 'neutral' && <Minus className="w-3 h-3 text-muted-foreground" />}
            {trendValue && <span className="text-xs text-muted-foreground">{trendValue}</span>}
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
