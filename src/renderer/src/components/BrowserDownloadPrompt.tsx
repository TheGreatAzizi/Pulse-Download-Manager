import { useState } from 'react'
import { ArrowDownToLine, Clock, Globe, Loader2, Trash2 } from 'lucide-react'
import { useApp } from '../state'
import { Modal } from './Modal'
import { cleanIpcError, hostOf } from '../lib/format'

/**
 * IDM-style confirmation for downloads sent by the browser extension.
 * Tasks arrive paused, so closing this dialog keeps them for later instead of
 * starting or deleting anything by accident.
 */
export function BrowserDownloadPrompt(): React.JSX.Element {
  const { browserPrompt, dismissBrowserPrompt, pushToast, setSelectedId, setView, t } = useApp()
  const [busy, setBusy] = useState<'now' | 'cancel' | null>(null)

  const tasks = browserPrompt || []
  const open = tasks.length > 0
  const multiple = tasks.length > 1
  const ids = tasks.map((task) => task.id)
  const title = multiple
    ? t.browserPrompt.batchTitle.replace('{count}', String(tasks.length))
    : t.browserPrompt.title
  const hint = multiple ? t.browserPrompt.batchHint : t.browserPrompt.hint

  const later = (): void => {
    if (busy) return
    dismissBrowserPrompt(ids)
    pushToast(
      'success',
      multiple
        ? t.browserPrompt.savedBatch.replace('{count}', String(tasks.length))
        : t.browserPrompt.saved
    )
  }

  const start = async (): Promise<void> => {
    if (busy) return
    setBusy('now')
    try {
      const count = await window.pulse.resumeTasks(ids)
      dismissBrowserPrompt(ids)
      if (count > 0) {
        if (tasks[0]) {
          setSelectedId(tasks[0].id)
          setView('all')
        }
        pushToast(
          'success',
          multiple
            ? t.browserPrompt.startedBatch.replace('{count}', String(count))
            : t.browserPrompt.started
        )
      }
    } catch (err) {
      pushToast('error', cleanIpcError(err, t.browserPrompt.actionFailed))
    } finally {
      setBusy(null)
    }
  }

  const cancel = async (): Promise<void> => {
    if (busy) return
    setBusy('cancel')
    try {
      const count = await window.pulse.removeTasks(ids, false)
      dismissBrowserPrompt(ids)
      pushToast(
        'info',
        multiple
          ? t.browserPrompt.canceledBatch.replace('{count}', String(count))
          : t.browserPrompt.canceled
      )
    } catch (err) {
      pushToast('error', cleanIpcError(err, t.browserPrompt.actionFailed))
    } finally {
      setBusy(null)
    }
  }

  const visible = tasks.slice(0, multiple ? 4 : 1)

  return (
    <Modal open={open} onClose={later} width={560} label={title}>
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
            <Globe size={20} />
          </div>
          <div className="min-w-0 flex-1 pe-6">
            <h2 className="text-[15px] font-extrabold tracking-tight">{title}</h2>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{hint}</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-line bg-elev/30 p-3">
          {visible.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2.5 py-1.5 first:pt-0 last:pb-0"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <ArrowDownToLine size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-semibold" dir="auto">
                  {task.fileName || task.name}
                </div>
                <div className="truncate text-[9.5px] text-faint" dir="ltr">
                  {hostOf(task.url)}
                </div>
              </div>
            </div>
          ))}
          {tasks.length > visible.length ? (
            <div className="pt-1.5 text-[9.5px] text-faint">
              {t.browserPrompt.more.replace('{count}', String(tasks.length - visible.length))}
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-[9.5px] text-faint">
          <Clock size={11} />
          {t.browserPrompt.waiting}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={!!busy}
            className="btn btn-ghost h-9 px-3 text-[11px]"
          >
            {busy === 'cancel' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {multiple ? t.browserPrompt.cancelAll : t.browserPrompt.cancel}
          </button>
          <button
            type="button"
            onClick={later}
            disabled={!!busy}
            className="btn btn-soft h-9 px-3.5 text-[11px]"
          >
            <Clock size={13} />
            {multiple ? t.browserPrompt.laterAll : t.browserPrompt.later}
          </button>
          <button
            type="button"
            onClick={() => void start()}
            disabled={!!busy}
            className="btn btn-primary h-9 min-w-[130px] px-4 text-[11px]"
          >
            {busy === 'now' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={13} />
            )}
            {multiple ? t.browserPrompt.startAll : t.browserPrompt.startNow}
          </button>
        </div>
      </div>
    </Modal>
  )
}
