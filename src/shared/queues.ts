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

/**
 * A queue is open when it is enabled and the local clock is inside its
 * schedule. A window whose end is earlier than its start crosses midnight;
 * days refer to the day the window starts. Equal start and end times mean a
 * full-day window on the selected days.
 */
export function queueIsActive(queue: DownloadQueue, at: Date = new Date()): boolean {
  if (!queue.enabled) return false
  if (queue.schedule !== 'window') return true
  const start = timeToMinutes(queue.start)
  const end = timeToMinutes(queue.end)
  if (start === end) return queue.days.includes(at.getDay())
  const minutes = at.getHours() * 60 + at.getMinutes()
  const day = at.getDay()
  if (start < end) {
    return queue.days.includes(day) && minutes >= start && minutes < end
  }
  const previousDay = (day + 6) % 7
  return (
    (queue.days.includes(day) && minutes >= start) ||
    (queue.days.includes(previousDay) && minutes < end)
  )
}

/** Localized in the renderer; shared code only needs the raw values. */
export function queueUsesWindow(queue: DownloadQueue): boolean {
  return queue.schedule === 'window'
}
