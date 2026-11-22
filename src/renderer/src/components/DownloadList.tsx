import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownUp,
  CheckSquare,
  Copy,
  ExternalLink,
  FolderOpen,
  LayoutGrid,
  Link2,
  ListChecks,
  Pause,
  Play,
  Plus,
  RotateCw,
  Trash2,
  Trash,
  X
} from 'lucide-react'
import type { DownloadTask } from '@shared/types'
import { DEFAULT_QUEUE_ID, resolveQueueId } from '@shared/queues'
import { useApp, type SortId, type ViewId } from '../state'
import { queueCopy } from '../queueI18n'
import { cn, formatBytes, formatEta, formatSpeed, hostOf, percentOf, isActive } from '../lib/format'
import { EmptyArt, KindIcon, ProgressBar, StatusPill } from './primitives'
import { Modal } from './Modal'

function matchesView(task: DownloadTask, view: ViewId): boolean {
  switch (view) {
    case 'all':
      return true
    case 'active':
      return isActive(task) || task.status === 'queued'
    case 'completed':
      return task.status === 'completed'
    case 'paused':
      return task.status === 'paused'
    case 'error':
      return task.status === 'error' || task.status === 'canceled'
    case 'youtube':
      return task.kind === 'youtube'
    case 'torrents':
      return task.kind === 'torrent'
    case 'direct':
      return task.kind === 'http'
    default:
      return task.category === view
  }
}

function fillCount(template: string, count: number): string {
  return template.replace('{count}', String(count))
}

export function DownloadList(): React.JSX.Element {
  const {
    t,
    tasks,
    view,
    query,
    sort,
    setSort,
    setSelectedId,
    selectedId,
    pushToast,
    openAdd,
    stats,
    settings,
    lang,
    queueFilter,
    setQueueFilter
  } = useApp()
  const copy = queueCopy[lang]
  const [removeState, setRemoveState] = useState<{ ids: string[]; name?: string } | null>(null)
  const [deleteFile, setDeleteFile] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = tasks.filter((task) => matchesView(task, view))
    if (queueFilter) {
      list = list.filter(
        (task) => resolveQueueId(settings.queues, task.queueId) === queueFilter
      )
    }
    if (q) {
      list = list.filter(
        (task) =>
          task.name.toLowerCase().includes(q) ||
          task.url.toLowerCase().includes(q) ||
          (task.fileName || '').toLowerCase().includes(q) ||
          hostOf(task.url).toLowerCase().includes(q)
      )
    }
    const sorted = list.slice()
    switch (sort) {
      case 'newest':
        sorted.sort((a, b) => b.createdAt - a.createdAt)
        break
      case 'oldest':
        sorted.sort((a, b) => a.createdAt - b.createdAt)
        break
      case 'size':
        sorted.sort((a, b) => (b.size || 0) - (a.size || 0))
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'progress':
        sorted.sort((a, b) => percentOf(b) - percentOf(a))
        break
      default:
        break
    }
    return sorted
  }, [tasks, view, query, sort, queueFilter, settings.queues])

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of prev) {
        if (tasks.some((task) => task.id === id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [tasks])

  useEffect(() => {
    if (!selectMode) setSelectedIds((prev) => (prev.size ? new Set() : prev))
  }, [selectMode])

  // Hidden selections could otherwise be acted on after changing the view,
  // search text or queue filter.
  useEffect(() => {
    setSelectedIds((prev) => (prev.size ? new Set() : prev))
  }, [view, query, queueFilter])

  const toggleSelected = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((task) => selectedIds.has(task.id))

  const toggleAll = (): void => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev)
        for (const task of filtered) next.delete(task.id)
        return next
      }
      const next = new Set(prev)
      for (const task of filtered) next.add(task.id)
      return next
    })
  }

  const queueNameFor = (id: string): string => {
    const queue = settings.queues.find((item) => item.id === id)
    if (!queue) return copy.defaultQueue
    return queue.id === DEFAULT_QUEUE_ID ? copy.defaultQueue : queue.name || copy.defaultQueue
  }

  const pauseAll = async (): Promise<void> => {
    const count = await window.pulse.pauseAll()
    if (count > 0) pushToast('info', t.toast.pausedAll)
  }

  const pauseSelected = async (): Promise<void> => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const count = await window.pulse.pauseTasks(ids)
    pushToast('info', fillCount(copy.pausedCount, count))
    setSelectedIds(new Set())
  }

  const resumeSelected = async (): Promise<void> => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const count = await window.pulse.resumeTasks(ids)
    pushToast('info', fillCount(copy.resumedCount, count))
    setSelectedIds(new Set())
  }

  const moveSelected = async (queueId: string): Promise<void> => {
    if (!queueId || selectedIds.size === 0) return
    const count = await window.pulse.setTasksQueue([...selectedIds], queueId)
    pushToast('info', fillCount(copy.movedCount, count))
    setSelectedIds(new Set())
  }

  const remove = async (): Promise<void> => {
    if (!removeState) return
    const { ids } = removeState
    if (ids.length > 1) {
      const count = await window.pulse.removeTasks(ids, deleteFile)
      pushToast('info', fillCount(copy.deletedCount, count))
    } else if (ids.length === 1) {
      await window.pulse.removeTask(ids[0], deleteFile)
      pushToast('info', t.toast.removed)
    }
    setRemoveState(null)
    setDeleteFile(false)
    setSelectedIds(new Set())
  }

  const sortOptions: Array<{ id: SortId; label: string }> = [
    { id: 'newest', label: t.toolbar.sortNewest },
    { id: 'oldest', label: t.toolbar.sortOldest },
    { id: 'size', label: t.toolbar.sortSize },
    { id: 'name', label: t.toolbar.sortName },
    { id: 'progress', label: t.toolbar.sortProgress }
  ]

  const pauseCandidates = [...selectedIds].some((id) => {
    const task = tasks.find((item) => item.id === id)
    return !!task && (isActive(task) || task.status === 'queued')
  })
  const resumeCandidates = [...selectedIds].some((id) => {
    const task = tasks.find((item) => item.id === id)
    return !!task && ['paused', 'error', 'canceled'].includes(task.status)
  })
  const anyPausable = tasks.some((task) => isActive(task) || task.status === 'queued')
  const visibleSize = filtered.reduce((acc, task) => acc + (task.size || 0), 0)

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-5 pb-2 pt-0.5">
        <div className="text-[10.5px] font-medium text-faint">
          {filtered.length} {t.stats.tasks}
          {filtered.length > 0 ? (
            <span className="ms-1.5 normal-case tracking-normal text-faint/80">
              <span className="mx-1">·</span>
              <span dir="ltr" className="inline-block">
                {formatBytes(visibleSize)}
              </span>
            </span>
          ) : null}
        </div>

        {queueFilter ? (
          <button
            type="button"
            onClick={() => setQueueFilter(null)}
            className="chip border-brand/25! bg-brand/10! text-[10px]! text-brand!"
            title={copy.clearFilter}
          >
            <ListChecks size={11} />
            {queueNameFor(queueFilter)}
            <X size={11} />
          </button>
        ) : null}

        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {anyPausable ? (
            <button
              type="button"
              onClick={() => void pauseAll()}
              className="flex items-center gap-1 rounded-md border border-line/70 px-2 py-1 text-[10.5px] font-medium text-muted transition hover:border-line2 hover:bg-elev2 hover:text-ink"
              title={t.toolbar.pauseAll}
            >
              <Pause size={12} />
              {copy.pauseAll}
            </button>
          ) : null}

          {filtered.length > 0 ? (
            <button
              type="button"
              onClick={() => setSelectMode((value) => !value)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[10.5px] font-medium transition',
                selectMode
                  ? 'bg-brand/15 text-brand'
                  : 'text-muted hover:bg-elev2 hover:text-ink'
              )}
              aria-pressed={selectMode}
            >
              <CheckSquare size={12} />
              {copy.select}
            </button>
          ) : null}

          {sort === 'newest' ? (
            <ArrowDownUp size={13} className="text-faint" />
          ) : (
            <ArrowDownUp size={13} className="text-brand" />
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            aria-label={t.toolbar.sort}
            className="field h-7 cursor-pointer appearance-none bg-transparent border-transparent! px-1.5 text-[10.5px] text-muted hover:border-line2!"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-panel text-ink">
                {opt.label}
              </option>
            ))}
          </select>
          {tasks.some((x) => x.status === 'completed') ? (
            <button
              type="button"
              onClick={() => {
                void window.pulse.clearCompleted()
                pushToast('info', t.toast.removed)
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-faint transition hover:bg-elev2 hover:text-bad"
            >
              <Trash size={12} />
              {t.toolbar.clear}
            </button>
          ) : null}
        </div>
      </div>

      {selectMode ? (
        <div className="mx-5 mb-2 flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand/8 px-3 py-2">
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand transition hover:bg-brand/10"
          >
            <CheckSquare size={13} />
            {allVisibleSelected ? copy.clearSelection : copy.selectAll}
          </button>
          <span className="text-[11px] text-muted">
            {fillCount(copy.selected, selectedIds.size)}
          </span>

          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!pauseCandidates}
              onClick={() => void pauseSelected()}
              className="btn btn-ghost h-8 px-2.5 text-[11px] disabled:opacity-40"
            >
              <Pause size={12} />
              {copy.bulkPause}
            </button>
            <button
              type="button"
              disabled={!resumeCandidates}
              onClick={() => void resumeSelected()}
              className="btn btn-ghost h-8 px-2.5 text-[11px] disabled:opacity-40"
            >
              <Play size={12} />
              {copy.bulkResume}
            </button>
            <select
              value=""
              disabled={selectedIds.size === 0}
              onChange={(e) => {
                const value = e.target.value
                e.currentTarget.value = ''
                if (value) void moveSelected(value)
              }}
              aria-label={copy.assign}
              className="field h-8 max-w-[170px] cursor-pointer px-2 text-[11px] disabled:opacity-40"
            >
              <option value="" disabled>
                {copy.assign}
              </option>
              {settings.queues.map((queue) => (
                <option key={queue.id} value={queue.id} className="bg-panel text-ink">
                  {queue.id === DEFAULT_QUEUE_ID ? copy.defaultQueue : queue.name || copy.defaultQueue}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => {
                setRemoveState({ ids: [...selectedIds] })
                setDeleteFile(false)
              }}
              className="btn h-8 border-bad/30 bg-bad/12 px-2.5 text-[11px] font-semibold text-bad hover:bg-bad/20 disabled:opacity-40"
            >
              <Trash2 size={12} />
              {copy.bulkDelete}
            </button>
            <button
              type="button"
              onClick={() => setSelectMode(false)}
              className="icon-btn h-8 w-8"
              title={copy.clearSelection}
              aria-label={copy.clearSelection}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="scroll-y flex-1 px-5 pb-4">
        {filtered.length === 0 ? (
          <EmptyState
            filtered={tasks.length > 0}
            onAdd={() => openAdd()}
            title={tasks.length > 0 ? t.empty.filtered : t.empty.title}
            desc={tasks.length > 0 ? t.empty.filteredDesc : t.empty.desc}
            addLabel={t.empty.add}
          />
        ) : (
          <div className="space-y-2 pb-2">
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                selected={selectedId === task.id}
                checked={selectedIds.has(task.id)}
                selectMode={selectMode}
                queueName={queueNameFor(resolveQueueId(settings.queues, task.queueId))}
                onSelect={() => setSelectedId(task.id)}
                onToggle={() => toggleSelected(task.id)}
                onRemove={() => {
                  setRemoveState({ ids: [task.id], name: task.name })
                  setDeleteFile(false)
                }}
                onToast={pushToast}
              />
            ))}
          </div>
        )}
        {stats && stats.activeCount > 0 ? (
          <div className="pb-4 text-center text-[10px] text-faint">
            {stats.activeCount} {t.stats.active.toLowerCase()}
            <span className="mx-1.5">·</span>
            {formatSpeed(stats.downSpeed)}
          </div>
        ) : null}
      </div>

      <Modal
        open={!!removeState}
        onClose={() => {
          setRemoveState(null)
          setDeleteFile(false)
        }}
        width={440}
        hideClose
        label={removeState && removeState.ids.length > 1 ? copy.bulkDeleteTitle : t.common.removeTitle}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bad/12 text-bad">
              <Trash2 size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[14px] font-bold">
                {removeState && removeState.ids.length > 1
                  ? copy.bulkDeleteTitle
                  : t.common.removeTitle}
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                {removeState && removeState.ids.length > 1
                  ? fillCount(copy.bulkDeleteDesc, removeState.ids.length)
                  : t.common.removeDesc}
              </p>
              {removeState?.name ? (
                <div className="mt-2 truncate rounded-lg bg-elev2/60 px-2 py-1.5 text-[11px] text-muted">
                  {removeState.name}
                </div>
              ) : null}
            </div>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-2 text-[11.5px] text-muted">
            <input
              type="checkbox"
              checked={deleteFile}
              onChange={(e) => setDeleteFile(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--c-bad)]"
            />
            {copy.deleteFilesToo}
          </label>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost h-9 px-3 text-[11.5px]"
              onClick={() => {
                setRemoveState(null)
                setDeleteFile(false)
              }}
            >
              {t.common.cancel}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              className="btn h-9 border-bad/30 bg-bad/15 px-3 text-[11.5px] font-semibold text-bad hover:bg-bad/25"
            >
              <Trash2 size={14} />
              {removeState && removeState.ids.length > 1 ? copy.bulkDelete : t.common.delete}
            </button>
          </div>
        </div>
      </Modal>
    </section>
  )
}

function TaskRow({
  task,
  selected,
  checked,
  selectMode,
  queueName,
  onSelect,
  onToggle,
  onRemove,
  onToast
}: {
  task: DownloadTask
  selected: boolean
  checked: boolean
  selectMode: boolean
  queueName: string
  onSelect: () => void
  onToggle: () => void
  onRemove: () => void
  onToast: (level: 'info' | 'success' | 'error', message: string) => void
}): React.JSX.Element {
  const { t, lang, openNewLink, settings } = useApp()
  const percent = percentOf(task)
  const active = task.status === 'downloading'
  const paused = task.status === 'paused' || task.status === 'error' || task.status === 'canceled'
  const completed = task.status === 'completed'
  const expiredLink = task.kind === 'http' && !!task.linkExpired

  const metaParts: string[] = []
  const resolvedQueue = resolveQueueId(settings.queues, task.queueId)
  if (resolvedQueue !== DEFAULT_QUEUE_ID) metaParts.push(queueName)
  if (task.kind === 'youtube') {
    if (task.youtube?.quality) metaParts.push(task.youtube.quality)
    if (task.youtube?.duration) metaParts.push(`${Math.floor(task.youtube.duration / 60)}:${String(Math.floor(task.youtube.duration % 60)).padStart(2, '0')}`)
    if (task.youtube?.uploader) metaParts.push(task.youtube.uploader)
  } else if (task.kind === 'torrent') {
    metaParts.push(`${task.torrent?.peers ?? 0} ${t.row.peers}`)
    if (task.torrent?.files?.length) metaParts.push(`${task.torrent.files.length} ${t.detail.files}`)
    if (task.torrent?.ratio) metaParts.push(`${t.detail.ratio} ${task.torrent.ratio.toFixed(2)}`)
  } else {
    metaParts.push(hostOf(task.url))
    if (task.resumable) metaParts.push(`${task.connections || 0} ${t.row.connections}`)
  }
  if (task.status === 'error' && task.error) {
    metaParts.push(task.linkExpired ? t.resume.expired : task.error)
  }

  const primaryAction = (): void => {
    if (expiredLink) {
      openNewLink(task.id)
    } else if (completed) {
      void window.pulse.openTask(task.id)
    } else if (active || task.status === 'queued' || task.status === 'connecting') {
      void window.pulse.pauseTask(task.id)
    } else if (paused) {
      void window.pulse.resumeTask(task.id)
    }
  }

  const copyLink = async (): Promise<void> => {
    try {
      await window.pulse.writeClipboard(task.url)
      onToast('success', t.toast.copied)
    } catch {
      onToast('error', t.toast.copyFailed)
    }
  }

  return (
    <div
      className={cn(
        'row-hover group relative overflow-hidden rounded-xl2 border border-line/70 bg-panel',
        (selected || checked) && 'row-selected'
      )}
    >
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        {selectMode ? (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={checked}
            aria-label={task.name}
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border transition',
              checked
                ? 'border-brand bg-brand text-white'
                : 'border-line2 bg-elev2 text-transparent hover:border-brand/60'
            )}
          >
            <CheckSquare size={13} />
          </button>
        ) : null}

        <button
          type="button"
          onClick={selectMode ? onToggle : onSelect}
          onDoubleClick={() => {
            if (!selectMode && completed) void window.pulse.openTask(task.id)
          }}
          aria-label={`${task.name}, ${t.status[task.status]}, ${Math.round(percent)}%`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-start"
        >
          <KindIcon task={task} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-[12.5px] font-semibold leading-tight" title={task.name}>
                {task.name}
              </span>
              <StatusPill status={task.status} label={t.status[task.status]} />
              {task.heldByQueue ? (
                <span className="chip py-0! text-[9px]! text-warn!">{queueCopy[lang].held}</span>
              ) : null}
              {task.kind === 'youtube' && task.youtube?.audioOnly ? (
                <span className="chip py-0! text-[9px]!">audio</span>
              ) : null}
              {task.kind === 'torrent' && task.torrent?.seeding ? (
                <span className="chip border-ok/25! py-0! text-[9px]! text-ok!">seed</span>
              ) : null}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[10.5px] text-muted">
              <span className="truncate" dir="auto">
                {metaParts.join(' · ')}
              </span>
            </span>
            <span className="mt-2 flex items-center gap-2.5">
              <span className="flex-1">
                <ProgressBar task={task} />
              </span>
              <span className="w-9 shrink-0 text-end text-[10px] font-medium tabular text-muted">
                {task.size > 0 ? `${percent.toFixed(percent >= 10 ? 0 : 1)}%` : '-'}
              </span>
            </span>
          </span>

          <span className="hidden w-[112px] shrink-0 flex-col items-end justify-center gap-0.5 xl:flex">
            <span
              dir="ltr"
              className={cn(
                'text-[11.5px] font-semibold tabular',
                active ? 'text-brand2' : completed ? 'text-ok' : 'text-muted'
              )}
            >
              {active
                ? formatSpeed(task.speed)
                : completed
                  ? formatBytes(task.size)
                  : task.size > 0
                    ? formatBytes(task.size)
                    : '-'}
            </span>
            <span className="text-[9.5px] text-faint tabular" dir={task.status === 'paused' ? 'ltr' : undefined}>
              {active
                ? `${t.row.eta} ${formatEta(task.eta, lang)}`
                : task.status === 'paused'
                  ? `${formatBytes(task.downloaded)} / ${task.size ? formatBytes(task.size) : '?'}`
                  : task.status === 'queued'
                    ? t.status.queued
                    : task.status === 'connecting'
                      ? t.row.processing
                      : task.status === 'error'
                        ? task.linkExpired
                          ? t.resume.expired.slice(0, 24)
                          : (task.error || '').slice(0, 24)
                        : task.kind === 'torrent'
                          ? `${task.torrent?.peers ?? 0} ${t.row.peers}`
                          : t.status[task.status]}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition group-hover:opacity-100">
          <button
            type="button"
            className="icon-btn"
            title={completed ? t.row.open : active ? t.row.pause : expiredLink ? t.resume.newLink : t.row.resume}
            aria-label={completed ? t.row.open : active ? t.row.pause : expiredLink ? t.resume.newLink : t.row.resume}
            onClick={(e) => {
              e.stopPropagation()
              primaryAction()
            }}
          >
            {completed ? (
              <ExternalLink size={14} />
            ) : active || task.status === 'queued' || task.status === 'connecting' ? (
              <Pause size={14} />
            ) : expiredLink ? (
              <Link2 size={14} />
            ) : task.status === 'error' ? (
              <RotateCw size={14} />
            ) : (
              <Play size={14} />
            )}
          </button>
          <button
            type="button"
            className="icon-btn hidden sm:grid"
            title={t.row.folder}
            aria-label={t.row.folder}
            onClick={(e) => {
              e.stopPropagation()
              void window.pulse.revealTask(task.id)
            }}
          >
            <FolderOpen size={14} />
          </button>
          <button
            type="button"
            className="icon-btn hidden lg:grid"
            title={t.row.copy}
            aria-label={t.row.copy}
            onClick={(e) => {
              e.stopPropagation()
              void copyLink()
            }}
          >
            <Copy size={13} />
          </button>
          {task.kind === 'http' &&
          !expiredLink &&
          (task.status === 'error' || task.status === 'paused') ? (
            <button
              type="button"
              className="icon-btn text-brand!"
              title={t.resume.newLink}
              aria-label={t.resume.newLink}
              onClick={(e) => {
                e.stopPropagation()
                openNewLink(task.id)
              }}
            >
              <Link2 size={14} />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-btn hover:text-bad!"
            title={t.row.remove}
            aria-label={t.row.remove}
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyState({
  filtered,
  title,
  desc,
  addLabel,
  onAdd
}: {
  filtered: boolean
  title: string
  desc: string
  addLabel: string
  onAdd: () => void
}): React.JSX.Element {
  const { t, setQuery, setView, setQueueFilter } = useApp()
  return (
    <div className="anim-fade flex h-full min-h-[280px] flex-col items-center justify-center gap-4 py-10 text-center">
      <EmptyArt />
      <div>
        <h3 className="text-[14px] font-bold">{title}</h3>
        {desc ? <p className="mx-auto mt-1 max-w-xs text-[11.5px] leading-relaxed text-muted">{desc}</p> : null}
      </div>
      {!filtered ? (
        <button type="button" onClick={onAdd} className="btn btn-soft h-9 px-3.5 text-[11.5px]">
          <Plus size={14} />
          {addLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setQuery('')
            setView('all')
            setQueueFilter(null)
          }}
          className="btn btn-soft h-9 px-3.5 text-[11.5px]"
        >
          <LayoutGrid size={14} />
          {t.common.showAll}
        </button>
      )}
    </div>
  )
}
