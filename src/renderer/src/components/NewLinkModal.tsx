import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ClipboardPaste, Link2, Loader2, Play } from 'lucide-react'
import { useApp } from '../state'
import { Modal } from './Modal'
import { formatBytes } from '../lib/format'

export function NewLinkModal(): React.JSX.Element {
  const { t, tasks, newLinkId, closeNewLink, pushToast } = useApp()
  const task = tasks.find((x) => x.id === newLinkId) ?? null
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!newLinkId) return
    setUrl('')
    setError('')
    setBusy(false)
    const id = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => window.clearTimeout(id)
  }, [newLinkId])

  const keptPercent =
    task && task.size > 0 ? Math.min(100, Math.round((task.downloaded / task.size) * 100)) : 0

  const submit = async (): Promise<void> => {
    if (!task || busy) return
    const trimmed = url.trim()
    let valid = false
    try {
      const parsed = new URL(trimmed)
      valid = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      valid = false
    }
    if (!valid) {
      setError(t.resume.invalid)
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await window.pulse.resumeWithUrl(task.id, trimmed)
      if (!result.ok) {
        setError(result.error || t.resume.failed)
        return
      }
      pushToast('success', result.restarted ? t.resume.restarted : t.resume.started)
      closeNewLink()
    } catch {
      setError(t.resume.failed)
    } finally {
      setBusy(false)
    }
  }

  const paste = async (): Promise<void> => {
    try {
      const text = (await window.pulse.readClipboard()).trim()
      if (text) {
        setUrl(text)
        setError('')
      }
    } catch {
      // Clipboard access can fail when another app holds it; the user can still type.
    }
  }

  return (
    <Modal open={Boolean(task)} onClose={closeNewLink} width={480} label={t.resume.title}>
      <div className="flex items-start gap-3 px-6 pb-4 pt-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          <Link2 size={19} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight">{t.resume.title}</h2>
          <p className="text-[10.5px] leading-relaxed text-muted">{t.resume.hint}</p>
        </div>
      </div>

      <div className="space-y-3.5 border-t border-line/70 px-6 py-4">
        {task ? (
          <div className="rounded-xl border border-line/70 bg-elev/25 px-3 py-2.5">
            <div className="truncate text-[11.5px] font-semibold" title={task.name} dir="auto">
              {task.name}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted tabular">
              <span dir="ltr">
                {formatBytes(task.downloaded)} / {task.size ? formatBytes(task.size) : '?'}
              </span>
              {keptPercent > 0 ? (
                <span className="chip border-brand/25! py-0! text-[9px]! text-brand!">
                  {t.resume.keep.replace('{percent}', String(keptPercent))}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-[10.5px] font-semibold text-muted" htmlFor="new-link-url">
            {t.resume.linkLabel}
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input
                ref={inputRef}
                id="new-link-url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                }}
                placeholder={t.resume.placeholder}
                aria-label={t.resume.linkLabel}
                className="field h-10 w-full pl-9 pr-2 text-[12px]"
                dir="ltr"
                disabled={busy}
              />
            </div>
            <button
              type="button"
              className="btn btn-ghost h-10 px-3 text-[11px]"
              onClick={() => void paste()}
              disabled={busy}
              title={t.add.pasteClipboard}
            >
              <ClipboardPaste size={14} />
            </button>
          </div>
          {error ? (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-bad/25 bg-bad/8 px-2.5 py-2 text-[10.5px] text-bad">
              <AlertCircle size={13} className="mt-[1px] shrink-0" />
              <span className="min-w-0 flex-1 break-words">{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line/70 bg-panel/60 px-6 py-3">
        <button
          type="button"
          onClick={closeNewLink}
          disabled={busy}
          className="btn btn-ghost h-9 px-4 text-[11.5px]"
        >
          {t.common.cancel}
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !url.trim()}
          className="btn btn-primary h-9 min-w-[140px] px-4 text-[11.5px]"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {busy ? t.resume.working : t.resume.action}
        </button>
      </div>
    </Modal>
  )
}
