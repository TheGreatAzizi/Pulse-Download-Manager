import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarClock, Clock3, Plus, Star, Trash2 } from 'lucide-react'
import type { DownloadQueue } from '@shared/types'
import {
  ALL_DAYS,
  DEFAULT_QUEUE_ID,
  makeQueue,
  normalizeQueues,
  queueWindow,
  resolveQueueId
} from '@shared/queues'
import { useApp } from '../state'
import { queueCopy } from '../queueI18n'
import { Modal } from './Modal'
import { Toggle } from './primitives'
import { cn, formatClock, formatMoment } from '../lib/format'
import { queueScheduleSummary, queueStatusText, queueStatusTitle } from '../lib/schedule'
import { useNow } from '../lib/useNow'

export function QueueManagerModal(): React.JSX.Element {
  const { queuesOpen, setQueuesOpen, settings, patchSettings, pushToast, lang, tasks, t } = useApp()
  const copy = queueCopy[lang]
  const now = useNow(1000, queuesOpen)
  const [draft, setDraft] = useState<DownloadQueue[]>(settings.queues)
  const [defaultId, setDefaultId] = useState(settings.defaultQueueId)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const presets = [
    { label: copy.presetNight, days: [...ALL_DAYS], start: '01:00', end: '06:00' },
    { label: copy.presetWork, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
    { label: copy.presetWeekend, days: [0, 6], start: '00:00', end: '00:00' }
  ]

  useEffect(() => {
    if (!queuesOpen) return
    setDraft(settings.queues)
    setDefaultId(settings.defaultQueueId)
    setPendingDelete(null)
    // The draft resets only when the dialog opens, not on every task event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuesOpen])

  const update = (id: string, patch: Partial<DownloadQueue>): void => {
    setDraft((prev) => prev.map((queue) => (queue.id === id ? { ...queue, ...patch } : queue)))
  }

  const move = (index: number, direction: -1 | 1): void => {
    setDraft((prev) => {
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = prev.slice()
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  const add = (): void => {
    const name = copy.defaultNewName.replace('{count}', String(draft.length + 1))
    setDraft((prev) => [...prev, makeQueue(prev.length, name)])
  }

  const remove = (id: string): void => {
    if (id === DEFAULT_QUEUE_ID) return
    setDraft((prev) => prev.filter((queue) => queue.id !== id))
    if (defaultId === id) setDefaultId(DEFAULT_QUEUE_ID)
    setPendingDelete(null)
  }

  const save = (): void => {
    const queues = normalizeQueues(
      draft.map((queue, index) => ({
        ...queue,
        // The built-in default queue is localized, so it never keeps a name.
        name: queue.id === DEFAULT_QUEUE_ID ? '' : queue.name,
        order: index
      }))
    )
    const defaultQueueId = queues.some((queue) => queue.id === defaultId)
      ? defaultId
      : queues[0].id
    patchSettings({ queues, defaultQueueId })
    pushToast('success', copy.saved)
    setQueuesOpen(false)
  }

  const taskCount = (id: string): number =>
    tasks.filter((task) => resolveQueueId(settings.queues, task.queueId) === id).length

  return (
    <Modal
      open={queuesOpen}
      onClose={() => setQueuesOpen(false)}
      width={980}
      className="flex h-[760px] max-h-[90vh] flex-col"
      label={copy.title}
    >
      <div className="flex shrink-0 items-start gap-3 border-b border-line/70 px-6 pe-14 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand">
          <CalendarClock size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold tracking-tight">{copy.title}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{copy.subtitle}</p>
          <div
            className="mt-1 flex items-center gap-1.5 text-[11px] text-faint"
            title={Intl.DateTimeFormat().resolvedOptions().timeZone}
          >
            <Clock3 size={12} />
            {copy.localTime}
            <span dir="ltr" className="tabular">
              {formatClock(now, lang)}
            </span>
          </div>
        </div>
        <button type="button" onClick={add} className="btn btn-soft h-10 shrink-0 px-3.5 text-[12.5px]">
          <Plus size={15} />
          {copy.add}
        </button>
        <button type="button" onClick={save} className="btn btn-primary h-10 shrink-0 px-4 text-[12.5px]">
          {copy.save}
        </button>
      </div>

      <div className="scroll-y min-h-0 flex-1 space-y-3 p-5">
        {draft.map((queue, index) => {
          const isDefault = queue.id === DEFAULT_QUEUE_ID
          const isDefaultTarget = defaultId === queue.id
          const state = queueWindow(queue, now)
          const active = state.open
          return (
            <div
              key={queue.id}
              className={cn(
                'rounded-xl2 border p-4 transition',
                queue.enabled ? 'border-line bg-panel' : 'border-line/60 bg-elev/25 opacity-80'
              )}
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    className="icon-btn h-6 w-6"
                    title={copy.moveUp}
                    aria-label={copy.moveUp}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn h-6 w-6"
                    title={copy.moveDown}
                    aria-label={copy.moveDown}
                    disabled={index === draft.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={13} />
                  </button>
                </div>

                <input
                  value={isDefault ? copy.defaultQueue : queue.name}
                  onChange={(e) => update(queue.id, { name: e.target.value })}
                  placeholder={isDefault ? copy.defaultQueue : copy.namePlaceholder}
                  aria-label={copy.name}
                  disabled={isDefault}
                  className="field h-10 min-w-0 flex-1 px-3 text-[13px] font-semibold disabled:opacity-70"
                />

                {isDefault ? <span className="chip text-[11px]! text-brand!">{copy.defaultBadge}</span> : null}

                <span
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium',
                    active ? 'bg-ok/12 text-ok' : 'bg-elev2 text-faint'
                  )}
                  title={queueStatusTitle(queue, state, copy, lang)}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-ok' : 'bg-faint')} />
                  {queueStatusText(queue, state, copy, lang, now)}
                </span>

                <span className="text-[11.5px] text-faint">
                  {taskCount(queue.id)} {copy.tasks}
                </span>

                <button
                  type="button"
                  onClick={() => setDefaultId(queue.id)}
                  className={cn(
                    'icon-btn h-9 w-9',
                    isDefaultTarget ? 'text-warn!' : 'text-faint hover:text-warn!'
                  )}
                  title={copy.defaultForNew}
                  aria-label={copy.defaultForNew}
                  aria-pressed={isDefaultTarget}
                >
                  <Star size={16} fill={isDefaultTarget ? 'currentColor' : 'none'} />
                </button>

                <div className="flex items-center gap-2 rounded-lg bg-elev2/60 px-2.5 py-1.5">
                  <span className="text-[11.5px] text-muted">
                    {queue.enabled ? copy.enabled : copy.disabled}
                  </span>
                  <Toggle
                    checked={queue.enabled}
                    onChange={(value) => update(queue.id, { enabled: value })}
                    label={copy.enabled}
                  />
                </div>

                <button
                  type="button"
                  className="icon-btn h-9 w-9 hover:text-bad!"
                  title={copy.remove}
                  aria-label={copy.remove}
                  disabled={isDefault}
                  onClick={() => setPendingDelete(queue.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint">
                <span>{queueScheduleSummary(queue, copy, lang)}</span>
                {queue.enabled && queue.schedule === 'window' && state.nextChange ? (
                  <span className="flex items-center gap-1">
                    <Clock3 size={11} />
                    {copy.nextChange}:
                    <span dir="ltr" className="tabular">
                      {formatMoment(state.nextChange, lang)}
                    </span>
                  </span>
                ) : null}
              </div>

              {pendingDelete === queue.id ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-bad/30 bg-bad/8 px-3 py-2.5 text-[12px]">
                  <span className="font-semibold text-bad">{copy.removeTitle}</span>
                  <span className="min-w-0 flex-1 text-muted">{copy.removeDesc}</span>
                  <button
                    type="button"
                    className="btn btn-ghost h-8 px-2.5 text-[11.5px]"
                    onClick={() => setPendingDelete(null)}
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    className="btn h-8 border-bad/30 bg-bad/15 px-3 text-[11.5px] font-semibold text-bad hover:bg-bad/25"
                    onClick={() => remove(queue.id)}
                  >
                    {copy.removeConfirm}
                  </button>
                </div>
              ) : null}

              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_160px_160px]">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">{copy.schedule}</span>
                  <select
                    value={queue.schedule}
                    onChange={(e) =>
                      update(queue.id, { schedule: e.target.value === 'window' ? 'window' : 'always' })
                    }
                    className="field h-9 w-full px-2.5 text-[12px]"
                  >
                    <option value="always">{copy.always}</option>
                    <option value="window">{copy.window}</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">{copy.start}</span>
                  <input
                    type="time"
                    value={queue.start}
                    disabled={queue.schedule !== 'window'}
                    onChange={(e) => update(queue.id, { start: e.target.value || '00:00' })}
                    className="field h-9 w-full px-2.5 text-[12px] tabular disabled:opacity-50"
                    dir="ltr"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-medium text-muted">{copy.end}</span>
                  <input
                    type="time"
                    value={queue.end}
                    disabled={queue.schedule !== 'window'}
                    onChange={(e) => update(queue.id, { end: e.target.value || '23:59' })}
                    className="field h-9 w-full px-2.5 text-[12px] tabular disabled:opacity-50"
                    dir="ltr"
                  />
                </label>
              </div>

              {queue.schedule === 'window' ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-faint">{copy.presets}:</span>
                  {presets.map((preset) => {
                    const selected =
                      queue.start === preset.start &&
                      queue.end === preset.end &&
                      queue.days.length === preset.days.length &&
                      preset.days.every((day) => queue.days.includes(day))
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          update(queue.id, {
                            schedule: 'window',
                            days: [...preset.days],
                            start: preset.start,
                            end: preset.end
                          })
                        }
                        aria-pressed={selected}
                        className={cn(
                          'rounded-md border px-2 py-1 text-[11px] font-medium transition',
                          selected
                            ? 'border-brand/35 bg-brand/15 text-brand'
                            : 'border-line bg-elev2/50 text-muted hover:border-line2'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {queue.schedule === 'window' ? (
                <div className="mt-3">
                  <span className="mb-1.5 block text-[11px] font-medium text-muted">{copy.days}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {copy.dayNames.map((day, dayIndex) => {
                      const selected = queue.days.includes(dayIndex)
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            update(queue.id, {
                              days: selected
                                ? queue.days.filter((value) => value !== dayIndex)
                                : [...queue.days, dayIndex].sort((a, b) => a - b)
                            })
                          }
                          className={cn(
                            'rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition',
                            selected
                              ? 'border-brand/35 bg-brand/15 text-brand'
                              : 'border-line bg-elev2/50 text-muted hover:border-line2'
                          )}
                        >
                          {day}
                        </button>
                      )
                    })}
                  </div>
                  {queue.days.length === 0 ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-bad">{copy.noDaysWarning}</p>
                  ) : null}
                  {queue.start === queue.end ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-faint">{copy.allDayHint}</p>
                  ) : queue.start > queue.end ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-faint">{copy.overnight}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-muted">{copy.limit}</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={queue.maxConcurrent}
                    onChange={(e) =>
                      update(queue.id, {
                        maxConcurrent: Math.max(0, Math.min(20, Number(e.target.value) || 0))
                      })
                    }
                    className="field h-8 w-[74px] px-2 text-[12px] tabular"
                    dir="ltr"
                  />
                  <span className="text-[11px] text-faint">
                    {queue.maxConcurrent === 0 ? copy.unlimited : ''}
                  </span>
                </label>
                <span className="text-[11px] text-faint">{copy.limitHint}</span>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
