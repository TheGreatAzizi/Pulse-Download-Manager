import type { DownloadQueue } from '@shared/types'
import type { QueueWindowState } from '@shared/queues'
import type { Lang } from '../i18n'
import type { QueueCopy } from '../queueI18n'
import { formatEta, formatMoment, localeOf } from './format'

const WEEKDAYS = [1, 2, 3, 4, 5]
const WEEKEND = [0, 6]

function sameDays(days: number[], pattern: number[]): boolean {
  return days.length === pattern.length && pattern.every((day) => days.includes(day))
}

export function queueDaySummary(queue: DownloadQueue, copy: QueueCopy, lang: Lang): string {
  if (queue.days.length === 0) return copy.noDays
  if (queue.days.length === 7) return copy.everyDay
  if (sameDays(queue.days, WEEKDAYS)) return copy.weekdays
  if (sameDays(queue.days, WEEKEND)) return copy.weekends
  const names = [...queue.days].sort((a, b) => a - b).map((day) => copy.dayNames[day])
  try {
    return new Intl.ListFormat(localeOf(lang), { style: 'short', type: 'conjunction' }).format(
      names
    )
  } catch {
    return names.join(', ')
  }
}

export function queueScheduleSummary(
  queue: DownloadQueue,
  copy: QueueCopy,
  lang: Lang
): string {
  if (queue.schedule !== 'window') return copy.always
  const time = queue.start === queue.end ? copy.allDay : `${queue.start} - ${queue.end}`
  return `${queueDaySummary(queue, copy, lang)} · ${time}`
}

export function queueStatusText(
  queue: DownloadQueue,
  state: QueueWindowState,
  copy: QueueCopy,
  lang: Lang,
  now: Date
): string {
  if (!queue.enabled) return copy.disabled
  if (queue.schedule !== 'window') return copy.always
  if (queue.days.length === 0) return copy.neverOpens
  if (!state.nextChange) return state.open ? copy.open : copy.neverOpens
  const seconds = Math.max(1, Math.ceil((state.nextChange.getTime() - now.getTime()) / 1000))
  const template = state.open ? copy.closesIn : copy.opensIn
  return template.replace('{time}', formatEta(seconds, lang))
}

export function queueStatusTitle(
  queue: DownloadQueue,
  state: QueueWindowState,
  copy: QueueCopy,
  lang: Lang
): string {
  const summary = queueScheduleSummary(queue, copy, lang)
  if (!queue.enabled || queue.schedule !== 'window' || !state.nextChange) return summary
  return `${copy.nextChange}: ${formatMoment(state.nextChange, lang)} · ${summary}`
}
