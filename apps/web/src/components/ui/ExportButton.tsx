import { Download, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export interface ExportOption {
  label: string
  path: string
  filename?: string
}

interface Props {
  options: ExportOption[]
  className?: string
}

export function ExportButton({ options, className }: Props) {
  const [open, setOpen] = useState(false)

  function handleExport(opt: ExportOption) {
    setOpen(false)
    const link = document.createElement('a')
    link.href = `${BASE_URL}${opt.path}`
    if (opt.filename) link.download = opt.filename
    link.target = '_blank'
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        className="flex items-center gap-1 text-xs border rounded px-2.5 py-1.5 bg-background hover:bg-accent transition-colors font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <Download className="w-3 h-3" />
        Export
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-40 min-w-36 bg-background border rounded-lg shadow-lg overflow-hidden">
            {options.map((opt) => (
              <button
                key={opt.path}
                className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors"
                onClick={() => handleExport(opt)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
