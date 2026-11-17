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

export function formatEta(seconds: number, lang: Lang): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '-'
  const s = Math.round(seconds)
  if (s < 60) return lang === 'fa' ? `${s} ثانیه` : `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return lang === 'fa' ? `${m} دقیقه` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return lang === 'fa' ? `${h} ساعت ${rm} دقیقه` : `${h}h ${rm}m`
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
    return new Date(ts).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-US', {
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
    return new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US', {
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
