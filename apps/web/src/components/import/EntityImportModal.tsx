import { useState, useRef } from 'react'
import { X, Upload, Download, Link2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/hooks/useDialog'
import {
  useEntityImport, entityTemplateCsv, type ImportEntityType, type EntityImportResult,
} from '@/hooks/useImport'

const LABELS: Record<ImportEntityType, { title: string; columns: string }> = {
  portfolio: { title: 'Import Portfolios', columns: 'name*, description' },
  program: { title: 'Import Programs', columns: 'name*, description, start_date, end_date, budget_capex, budget_opex, portfolio' },
  project: { title: 'Import Projects', columns: 'name*, description, methodology, start_date, end_date, budget_capex, budget_opex, expected_benefit, program' },
  resource: { title: 'Import Resources', columns: 'name*, email, type(human|equipment)*, cost_type(capex|opex)*, rate, currency, capacity_hours_per_week, role, seniority_level, location' },
}

interface Props {
  entityType: ImportEntityType
  onClose: () => void
}

export function EntityImportModal({ entityType, onClose }: Props) {
  const ref = useDialog(true, onClose)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheetUrl, setSheetUrl] = useState('')
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<EntityImportResult | null>(null)
  const entityImport = useEntityImport(entityType)
  const meta = LABELS[entityType]

  function pickFile(f: File) {
    setFile(f)
    setResult(null)
  }

  function downloadTemplate() {
    const blob = new Blob([entityTemplateCsv(entityType)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${entityType}-import-template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function run() {
    if (!file && !sheetUrl.trim()) return
    const r = await entityImport.mutateAsync(file ? { file } : { sheetUrl: sheetUrl.trim() })
    setResult(r)
    setFile(null)
    setSheetUrl('')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div ref={ref} role="dialog" aria-modal="true" className="bg-background rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold">{meta.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* CSV upload */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-7 h-7 mx-auto mb-2 text-muted-foreground" />
            {file ? (
              <p className="text-sm font-medium">{file.name}</p>
            ) : (
              <p className="text-sm font-medium">Drop a .csv file — or click to browse</p>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f) }}
            />
          </div>

          {/* Google Sheets URL */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> or Google Sheets URL (shared “anyone with link” / published)
            </label>
            <input
              className="input-field w-full"
              placeholder="https://docs.google.com/spreadsheets/d/…"
              value={sheetUrl}
              onChange={(e) => { setSheetUrl(e.target.value); setResult(null) }}
            />
          </div>

          {/* Columns hint + template */}
          <div className="flex items-start justify-between gap-3 text-xs bg-muted/40 rounded-md px-3 py-2">
            <p className="text-muted-foreground"><span className="font-medium">Columns:</span> {meta.columns}</p>
            <button onClick={downloadTemplate} className="text-primary hover:underline whitespace-nowrap flex items-center gap-1">
              <Download className="w-3 h-3" /> Template
            </button>
          </div>

          <Button disabled={(!file && !sheetUrl.trim()) || entityImport.isPending} onClick={run} className="w-full">
            {entityImport.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Import
          </Button>

          {/* Result */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{result.created} created{result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}</span>
              </div>
              {result.errors.length > 0 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <p key={i}>Row {e.row}: {e.message}</p>)}
                </div>
              )}
            </div>
          )}

          {entityImport.isError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              <span>{(entityImport.error as Error)?.message ?? 'Import failed'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
