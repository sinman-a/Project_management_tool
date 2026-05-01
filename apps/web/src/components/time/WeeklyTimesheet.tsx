import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useWeekTimeLogs, useCreateTimeLog, useDeleteTimeLog } from '@/hooks/useTimeLogs'
import type { Task, TimeLog, Resource } from '@/types'

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d)
  date.setDate(date.getDate() + n)
  return date
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  assignedTasks: (Task & { projectName?: string })[]
  resource: Resource
}

export function WeeklyTimesheet({ assignedTasks, resource }: Props) {
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMonday(new Date()))
  const weekStart = toDateStr(weekMonday)

  const { data: existingLogs = [] } = useWeekTimeLogs(weekStart)
  const createLog = useCreateTimeLog()
  const deleteLog = useDeleteTimeLog()

  const [cellEdits, setCellEdits] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => toDateStr(addDays(weekMonday, i))), [weekMonday])

  // Build map: taskId_date → TimeLog (for cells that already have logged hours)
  const existingMap = useMemo(() => {
    const m: Record<string, TimeLog> = {}
    for (const log of existingLogs) {
      m[`${log.taskId}_${log.logDate}`] = log
    }
    return m
  }, [existingLogs])

  const getCellValue = useCallback((taskId: string, date: string): string => {
    const key = `${taskId}_${date}`
    if (key in cellEdits) return cellEdits[key]
    const existing = existingMap[key]
    return existing ? String(existing.hours) : ''
  }, [cellEdits, existingMap])

  const handleCell = (taskId: string, date: string, value: string) => {
    setCellEdits((prev) => ({ ...prev, [`${taskId}_${date}`]: value }))
  }

  const handleWeekChange = (direction: -1 | 1) => {
    setCellEdits({})
    setSaveError(null)
    setWeekMonday((prev) => addDays(prev, direction * 7))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const ops: Promise<unknown>[] = []

      for (const [key, rawValue] of Object.entries(cellEdits)) {
        // key format: "{uuid36}_{YYYY-MM-DD}"
        const taskIdParsed = key.substring(0, 36)
        const dateParsed = key.substring(37)

        const hours = parseFloat(rawValue)
        const existing = existingMap[key]

        if (existing && !existing.approvedAt) {
          ops.push(deleteLog.mutateAsync(existing.id))
        }
        if (!isNaN(hours) && hours > 0) {
          ops.push(
            createLog.mutateAsync({
              taskId: taskIdParsed,
              resourceId: resource.id,
              logDate: dateParsed,
              hours,
            }),
          )
        }
      }

      await Promise.all(ops)
      setCellEdits({})
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const hasPendingEdits = Object.keys(cellEdits).length > 0

  const dayTotals = days.map((date) =>
    assignedTasks.reduce((sum, task) => {
      const val = getCellValue(task.id, date)
      const n = parseFloat(val)
      return sum + (isNaN(n) ? 0 : n)
    }, 0),
  )

  const isCurrentWeek = toDateStr(getMonday(new Date())) === weekStart

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeekChange(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-medium min-w-[180px] text-center">
            {days[0]} — {days[6]}
            {isCurrentWeek && (
              <span className="ml-2 text-xs text-indigo-600 font-normal">Current week</span>
            )}
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeekChange(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button
          size="sm"
          disabled={!hasPendingEdits || saving}
          onClick={handleSave}
        >
          <Save className="w-3 h-3 mr-1" />
          {saving ? 'Saving…' : 'Save Week'}
        </Button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
          <AlertCircle className="w-4 h-4" />
          {saveError}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/30 text-xs text-muted-foreground">
              <th className="text-left py-2 px-3 font-medium min-w-[200px]">Task / Project</th>
              {days.map((date, i) => (
                <th key={date} className={cn(
                  'text-center py-2 px-2 font-medium w-[80px]',
                  i >= 5 && 'text-muted-foreground/60',
                )}>
                  <div>{DAY_LABELS[i]}</div>
                  <div className="font-normal text-[10px]">{date.slice(5)}</div>
                </th>
              ))}
              <th className="text-center py-2 px-3 font-medium w-[60px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {assignedTasks.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-muted-foreground">
                  No tasks assigned to you. Ask your project manager to assign tasks.
                </td>
              </tr>
            )}
            {assignedTasks.map((task) => {
              const rowTotal = days.reduce((sum, date) => {
                const val = getCellValue(task.id, date)
                const n = parseFloat(val)
                return sum + (isNaN(n) ? 0 : n)
              }, 0)

              return (
                <tr key={task.id} className="border-b hover:bg-muted/20">
                  <td className="py-2 px-3">
                    <div className="font-medium truncate max-w-[200px]">{task.name}</div>
                    {task.projectName && (
                      <div className="text-xs text-muted-foreground truncate">{task.projectName}</div>
                    )}
                  </td>
                  {days.map((date, i) => {
                    const key = `${task.id}_${date}`
                    const existing = existingMap[key]
                    const isApproved = existing?.approvedAt != null
                    const val = getCellValue(task.id, date)

                    return (
                      <td key={date} className={cn('py-1 px-1 text-center', i >= 5 && 'bg-muted/10')}>
                        {isApproved ? (
                          <div className="h-8 flex items-center justify-center text-xs text-green-700 font-medium bg-green-50 rounded">
                            {existing!.hours}h ✓
                          </div>
                        ) : (
                          <input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            placeholder="—"
                            value={val}
                            onChange={(e) => handleCell(task.id, date, e.target.value)}
                            className={cn(
                              'w-full h-8 text-center text-xs border rounded focus:outline-none focus:ring-1 focus:ring-ring',
                              val && parseFloat(val) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-background',
                            )}
                          />
                        )}
                      </td>
                    )
                  })}
                  <td className="py-2 px-3 text-center text-xs font-medium">
                    {rowTotal > 0 ? `${rowTotal}h` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 text-xs font-medium">
              <td className="py-2 px-3">Daily Total</td>
              {dayTotals.map((total, i) => (
                <td key={i} className={cn('py-2 px-2 text-center', total > 8 && 'text-amber-600')}>
                  {total > 0 ? `${total}h` : '—'}
                </td>
              ))}
              <td className="py-2 px-3 text-center">
                {dayTotals.reduce((s, t) => s + t, 0) > 0 ? `${dayTotals.reduce((s, t) => s + t, 0)}h` : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
