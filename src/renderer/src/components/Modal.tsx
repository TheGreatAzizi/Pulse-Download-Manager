import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../lib/format'
import { useApp } from '../state'

export function Modal({
  open,
  onClose,
  children,
  width = 760,
  className,
  hideClose = false,
  label
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  width?: number
  className?: string
  hideClose?: boolean
  label?: string
}): React.JSX.Element | null {
  const { t } = useApp()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop anim-fade fixed inset-0 z-[70] grid place-items-center p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn('panel anim-fade relative w-full overflow-hidden rounded-xl2 shadow-[var(--shadow-overlay)]', className)}
        style={{ maxWidth: width, maxHeight: '90vh' }}
      >
        {!hideClose ? (
          <button
            type="button"
            onClick={onClose}
            className="icon-btn absolute end-3 top-3 z-20"
            aria-label={t.common.close}
          >
            <X size={16} />
          </button>
        ) : null}
        {children}
      </div>
    </div>,
    document.body
  )
}
