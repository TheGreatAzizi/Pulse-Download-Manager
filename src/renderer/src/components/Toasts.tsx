import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useApp } from '../state'
import { cn } from '../lib/format'

export function Toasts(): React.JSX.Element {
  const { toasts, dismissToast } = useApp()

  return (
    <div className="pointer-events-none fixed bottom-10 start-5 z-[90] flex w-[330px] flex-col-reverse gap-2">
      {toasts.map((toast) => {
        const Icon = toast.level === 'success' ? CheckCircle2 : toast.level === 'error' ? AlertTriangle : Info
        return (
          <div
            key={toast.id}
            className="anim-toast pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line2 bg-panel/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl"
          >
            <div
              className={cn(
                'mt-[1px] grid h-6 w-6 shrink-0 place-items-center rounded-lg',
                toast.level === 'success' && 'bg-ok/12 text-ok',
                toast.level === 'error' && 'bg-bad/12 text-bad',
                toast.level === 'info' && 'bg-brand/12 text-brand'
              )}
            >
              <Icon size={13} />
            </div>
            <div className="min-w-0 flex-1 pt-[3px] text-[10.5px] leading-relaxed text-ink/90">
              {toast.message}
            </div>
            {toast.action ? (
              <button
                type="button"
                onClick={() => {
                  toast.action?.()
                  dismissToast(toast.id)
                }}
                className="shrink-0 rounded-md bg-brand/15 px-2 py-1 text-[9.5px] font-semibold text-brand transition hover:bg-brand/25"
              >
                {toast.actionLabel}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="shrink-0 text-faint transition hover:text-ink"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
