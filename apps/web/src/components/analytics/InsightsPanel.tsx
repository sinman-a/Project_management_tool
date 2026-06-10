import { useNavigate } from 'react-router-dom'
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { usePortfolioInsights } from '@/hooks/useAnalytics'

export function InsightsPanel() {
  const navigate = useNavigate()
  const { data: insights = [], isLoading } = usePortfolioInsights()

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Predictive Insights
          {insights.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({insights.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded" />)}
          </div>
        ) : insights.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 py-4">
            <CheckCircle2 className="w-4 h-4" /> No risks detected across the portfolio.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {insights.map((ins, i) => {
              const Icon = ins.severity === 'red' ? AlertCircle : AlertTriangle
              return (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-2 text-sm rounded-md px-2.5 py-2 border',
                    ins.severity === 'red' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
                    ins.projectId && 'cursor-pointer hover:brightness-95',
                  )}
                  onClick={() => ins.projectId && navigate(`/projects/${ins.projectId}`)}
                >
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', ins.severity === 'red' ? 'text-red-600' : 'text-amber-600')} />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{ins.projectName}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">{ins.category}:</span> {ins.message}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
