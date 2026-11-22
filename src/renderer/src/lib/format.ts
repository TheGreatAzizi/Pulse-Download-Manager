import type { DownloadTask, TaskStatus } from '@shared/types'
import type { Lang } from '../i18n'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function cleanIpcError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error || '')
  const cleaned = message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, '')
  return cleaned || fallback
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

export function formatBytes(bytes: number, digits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const i = Math.min(UNITS.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : digits)} ${UNITS[i]}`
}

export function formatSpeed(bytes: number): string {
  if (!bytes) return '0 B/s'
  return `${formatBytes(bytes, 1)}/s`
}

const LOCALES: Record<Lang, string> = {
  en: 'en-US',
  fa: 'fa-IR',
  ja: 'ja-JP',
  ru: 'ru-RU'
}

const TIME_UNITS: Record<
  Lang,
  { day: string; hour: string; minute: string; second: string; spaced: boolean }
> = {
  en: { day: 'd', hour: 'h', minute: 'm', second: 's', spaced: false },
  fa: { day: 'روز', hour: 'ساعت', minute: 'دقیقه', second: 'ثانیه', spaced: true },
  ja: { day: '日', hour: '時間', minute: '分', second: '秒', spaced: false },
  ru: { day: 'д', hour: 'ч', minute: 'мин', second: 'с', spaced: true }
}

function unit(value: number, label: string, lang: Lang): string {
  const units = TIME_UNITS[lang] || TIME_UNITS.en
  const count = numberFor(value, lang)
  return units.spaced ? `${count} ${label}` : `${count}${label}`
}

function joinUnits(parts: string[], lang: Lang): string {
  return parts.filter(Boolean).join(lang === 'ja' ? '' : ' ')
}

export function localeOf(lang: Lang): string {
  return LOCALES[lang] || LOCALES.en
}

/** Whole numbers in the active locale, including Persian digits. */
function numberFor(value: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(localeOf(lang), { useGrouping: false }).format(value)
  } catch {
    return String(value)
  }
}

/** Compact duration used by ETA fields and schedule countdowns. */
export function formatEta(seconds: number, lang: Lang): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-'
  const units = TIME_UNITS[lang] || TIME_UNITS.en
  const s = Math.round(seconds)
  if (s < 60) return unit(s, units.second, lang)
  const m = Math.floor(s / 60)
  if (m < 60) {
    const rs = s % 60
    if (rs > 0 && m < 10) {
      return joinUnits([unit(m, units.minute, lang), unit(rs, units.second, lang)], lang)
    }
    return unit(m, units.minute, lang)
  }
  const h = Math.floor(m / 60)
  if (h < 24) {
    const rm = m % 60
    return rm > 0
      ? joinUnits([unit(h, units.hour, lang), unit(rm, units.minute, lang)], lang)
      : unit(h, units.hour, lang)
  }
  const d = Math.floor(h / 24)
  const rh = h % 24
  return rh > 0
    ? joinUnits([unit(d, units.day, lang), unit(rh, units.hour, lang)], lang)
    : unit(d, units.day, lang)
}

/** Local wall clock with seconds, used by the schedule editor. */
export function formatClock(date: Date, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(localeOf(lang), {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).format(date)
  } catch {
    return date.toLocaleTimeString()
  }
}

/** Weekday and 24-hour time for the next schedule transition. */
export function formatMoment(date: Date, lang: Lang): string {
  try {
    return new Intl.DateTimeFormat(localeOf(lang), {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(date)
  } catch {
    return date.toLocaleString()
  }
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '-'
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export function formatDate(ts: number, lang: Lang): string {
  try {
    return new Date(ts).toLocaleString(localeOf(lang), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return new Date(ts).toLocaleString()
  }
}

export function compactNumber(n: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(localeOf(lang), {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(n)
  } catch {
    return String(n)
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    if (/^magnet:/i.test(url)) return 'BitTorrent'
    return url.slice(0, 32)
  }
}

export function percentOf(task: DownloadTask): number {
  if (task.status === 'completed') return 100
  if (!task.size || task.size <= 0) return 0
  return Math.max(0, Math.min(100, (task.downloaded / task.size) * 100))
}

export type StatusTone = 'brand' | 'ok' | 'warn' | 'bad' | 'muted'

export const STATUS_TONE: Record<TaskStatus, StatusTone> = {
  queued: 'muted',
  connecting: 'brand',
  downloading: 'brand',
  paused: 'warn',
  verifying: 'brand',
  completed: 'ok',
  error: 'bad',
  canceled: 'muted'
}

export const TONE_CLASS: Record<StatusTone, string> = {
  brand: 'text-brand bg-brand/10 border-brand/25',
  ok: 'text-ok bg-ok/10 border-ok/25',
  warn: 'text-warn bg-warn/10 border-warn/25',
  bad: 'text-bad bg-bad/10 border-bad/25',
  muted: 'text-muted bg-elev2/70 border-line'
}

export function isActive(task: DownloadTask): boolean {
  return task.status === 'downloading' || task.status === 'connecting' || task.status === 'verifying'
}

export function shortHash(hash: string): string {
  return hash ? hash.slice(0, 8) : ''
}

export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, '')
}

export function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

export function dirOf(path: string): string {
  const parts = path.split(/[\\/]/)
  parts.pop()
  return parts.join('/') || path
}
