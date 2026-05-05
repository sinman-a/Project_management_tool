import { X } from 'lucide-react'
import { ImportContent } from './ImportSection'

interface Props {
  onClose: () => void
}

export function ImportModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold">Import</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pb-5">
          <ImportContent />
        </div>
      </div>
    </div>
  )
}
