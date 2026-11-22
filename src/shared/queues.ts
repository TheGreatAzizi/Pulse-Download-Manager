import type { DownloadQueue } from './types'

export const DEFAULT_QUEUE_ID = 'default'

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

export function makeDefaultQueue(): DownloadQueue {
  return {
    id: DEFAULT_QUEUE_ID,
    name: '',
    enabled: true,
    schedule: 'always',
    days: [...ALL_DAYS],
    start: '00:00',
    end: '23:59',
    maxConcurrent: 0,
    order: 0
  }
}

export function makeQueue(order: number, name: string): DownloadQueue {
  return {
    id: `queue-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    enabled: true,
    schedule: 'always',
    days: [...ALL_DAYS],
    start: '01:00',
    end: '06:00',
    maxConcurrent: 0,
    order
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function validTime(value: unknown, fallback: string): string {
  const text = String(value ?? '')
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(text.trim())
  if (!match) return fallback
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export function timeToMinutes(value: string): number {
  const safe = validTime(value, '00:00')
  const [hours, minutes] = safe.split(':').map(Number)
  return hours * 60 + minutes
}

export function normalizeQueue(input: unknown, index: number): DownloadQueue {
  const raw = (input && typeof input === 'object' ? input : {}) as Partial<DownloadQueue>
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim().slice(0, 80)
      : index === 0
        ? DEFAULT_QUEUE_ID
        : `queue-${index}`
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [...ALL_DAYS]
  return {
    id,
    name:
      id === DEFAULT_QUEUE_ID
        ? typeof raw.name === 'string'
          ? raw.name.trim().slice(0, 80)
          : ''
        : (typeof raw.name === 'string' && raw.name.trim().slice(0, 80)) || `Queue ${index + 1}`,
    enabled: asBoolean(raw.enabled, true),
    schedule: raw.schedule === 'window' ? 'window' : 'always',
    days: days.length ? days.sort((a, b) => a - b) : [],
    start: validTime(raw.start, '01:00'),
    end: validTime(raw.end, '06:00'),
    maxConcurrent: Math.max(0, Math.min(20, Math.round(asNumber(raw.maxConcurrent, 0)))),
    order: Math.max(0, Math.round(asNumber(raw.order, index)))
  }
}

/** Repairs stored queue data and always guarantees a usable default queue. */
export function normalizeQueues(input: unknown): DownloadQueue[] {
  const source = Array.isArray(input) ? input : []
  const seen = new Set<string>()
  const queues: DownloadQueue[] = []
  for (let index = 0; index < source.length; index++) {
    const queue = normalizeQueue(source[index], index)
    if (seen.has(queue.id)) continue
    seen.add(queue.id)
    queues.push(queue)
  }
  if (!seen.has(DEFAULT_QUEUE_ID)) queues.unshift(makeDefaultQueue())
  return queues
    .sort((a, b) => a.order - b.order)
    .map((queue, index) => ({ ...queue, order: index }))
}

export function resolveQueueId(queues: DownloadQueue[], id?: string | null): string {
  if (id && queues.some((queue) => queue.id === id)) return id
  return queues.some((queue) => queue.id === DEFAULT_QUEUE_ID)
    ? DEFAULT_QUEUE_ID
    : queues[0]?.id || DEFAULT_QUEUE_ID
}

export interface QueueWindowState {
  open: boolean
  /** The next open or close moment, or null when the state never changes. */
  nextChange: Date | null
  /** When the queue opens next. Null while it is already open. */
  nextOpen: Date | null
  /** When the current open window ends. Null while it is closed. */
  nextClose: Date | null
}

interface QueueBounds {
  start: Date
  end: Date
}

function timeOnDay(day: Date, offset: number, minutes: number): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + offset,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0
  )
}

/**
 * Builds the concrete windows around the current day. Yesterday is included
 * so an overnight window that started before midnight is still found, and a
 * full week is included so the next opening can always be calculated.
 */
function queueBounds(queue: DownloadQueue, at: Date): QueueBounds[] {
  if (!queue.days.length) return []
  const start = timeToMinutes(queue.start)
  const end = timeToMinutes(queue.end)
  const fullDay = start === end
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate())
  const bounds: QueueBounds[] = []
  for (let offset = -1; offset <= 7; offset++) {
    const anchor = new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset)
    if (!queue.days.includes(anchor.getDay())) continue
    if (fullDay) {
      // Equal start and end times mean the whole selected calendar day.
      bounds.push({ start: timeOnDay(anchor, 0, 0), end: timeOnDay(anchor, 1, 0) })
    } else {
      bounds.push({
        start: timeOnDay(anchor, 0, start),
        end: timeOnDay(anchor, start < end ? 0 : 1, end)
      })
    }
  }
  return bounds
}

/**
 * Reports whether a queue is open and when it changes next. A window whose end
 * is earlier than its start crosses midnight; days refer to the day the window
 * starts. Equal start and end times mean a full-day window on the selected
 * days.
 */
export function queueWindow(queue: DownloadQueue, at: Date = new Date()): QueueWindowState {
  if (!queue.enabled) {
    return { open: false, nextChange: null, nextOpen: null, nextClose: null }
  }
  if (queue.schedule !== 'window') {
    return { open: true, nextChange: null, nextOpen: null, nextClose: null }
  }
  const bounds = queueBounds(queue, at)
  if (!bounds.length) {
    return { open: false, nextChange: null, nextOpen: null, nextClose: null }
  }
  const time = at.getTime()
  const current = bounds.find(
    (bound) => time >= bound.start.getTime() && time < bound.end.getTime()
  )
  let nextOpen: Date | null = null
  if (!current) {
    for (const bound of bounds) {
      const start = bound.start.getTime()
      if (start <= time) continue
      if (!nextOpen || start < nextOpen.getTime()) nextOpen = bound.start
    }
  }
  return {
    open: !!current,
    nextChange: current ? current.end : nextOpen,
    nextOpen,
    nextClose: current ? current.end : null
  }
}

/** A queue is open when it is enabled and the local clock is inside its schedule. */
export function queueIsActive(queue: DownloadQueue, at: Date = new Date()): boolean {
  return queueWindow(queue, at).open
}

/** Localized in the renderer; shared code only needs the raw values. */
export function queueUsesWindow(queue: DownloadQueue): boolean {
  return queue.schedule === 'window'
}
