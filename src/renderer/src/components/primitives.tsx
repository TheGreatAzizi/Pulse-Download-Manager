import type { CSSProperties, ReactNode } from 'react'
import {
  AppWindow,
  FileArchive,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Magnet,
  Music,
  Video as Youtube
} from 'lucide-react'
import type { DownloadTask, TaskStatus } from '@shared/types'
import { TONE_CLASS, STATUS_TONE, cn, percentOf } from '../lib/format'

export function Logo({ size = 30, glow = true }: { size?: number; glow?: boolean }): React.JSX.Element {
  return (
    <div
      className="relative grid place-items-center rounded-[0.85rem]"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, var(--c-brand), #7c5cf5 55%, var(--c-brand2))',
        boxShadow: glow ? '0 10px 26px -12px var(--c-brand)' : 'none'
      }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size * 0.66}
        height={size * 0.66}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M4 18h4.4l2.3-7.2 4.2 14 3-9.4 2 4.6H28"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function KindIcon({ task, size = 42 }: { task: DownloadTask; size?: number }): React.JSX.Element {
  const iconSize = Math.round(size * 0.44)
  const base = {
    width: size,
    height: size,
    borderRadius: Math.max(8, Math.round(size * 0.22))
  } as CSSProperties

  let Icon: typeof Globe = Globe

  if (task.kind === 'youtube') {
    Icon = Youtube
  } else if (task.kind === 'torrent') {
    Icon = Magnet
  } else {
    switch (task.category) {
      case 'video':
        Icon = Film
        break
      case 'audio':
        Icon = Music
        break
      case 'image':
        Icon = ImageIcon
        break
      case 'archive':
        Icon = FileArchive
        break
      case 'document':
        Icon = FileText
        break
      case 'app':
        Icon = AppWindow
        break
      default:
        Icon = Globe
        break
    }
  }

  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden border border-line bg-elev2 text-muted"
      style={base}
    >
      {task.category === 'image' && task.thumbnail ? (
        <img src={task.thumbnail} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon size={iconSize} strokeWidth={1.9} />
      )}
    </span>
  )
}

export function StatusPill({ status, label }: { status: TaskStatus; label: string }): React.JSX.Element {
  const tone = STATUS_TONE[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-[2px] text-[10.5px] font-semibold',
        TONE_CLASS[tone]
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          tone === 'brand' && 'bg-brand',
          tone === 'ok' && 'bg-ok',
          tone === 'warn' && 'bg-warn',
          tone === 'bad' && 'bg-bad',
          tone === 'muted' && 'bg-faint'
        )}
      />
      {label}
    </span>
  )
}

export function ProgressBar({
  task,
  height = 6
}: {
  task: DownloadTask
  height?: number
}): React.JSX.Element {
  const percent = percentOf(task)
  const indeterminate =
    (task.status === 'connecting' || task.status === 'verifying') && task.size === 0
  const active = task.status === 'downloading'
  const done = task.status === 'completed'
  const paused = task.status === 'paused' || task.status === 'queued'
  const error = task.status === 'error'
  return (
    <span className="progress-track block w-full" style={{ height }}>
      {indeterminate ? (
        <span className="indeterminate block h-full rounded-full" />
      ) : (
        <span
          className={cn(
            'progress-fill block',
            active && 'is-active',
            done && 'is-done',
            paused && 'is-paused',
            error && 'is-error'
          )}
          style={{ width: `${Math.max(done ? 100 : percent, percent > 0 ? 1.5 : 0)}%` }}
        />
      )}
    </span>
  )
}

export function Ring({
  percent,
  size = 128,
  stroke = 9,
  children,
  tone = 'brand'
}: {
  percent: number
  size?: number
  stroke?: number
  children?: ReactNode
  tone?: 'brand' | 'ok' | 'warn' | 'bad'
}): React.JSX.Element {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, percent))
  const colors: Record<string, string> = {
    brand: 'var(--c-brand)',
    ok: 'var(--c-ok)',
    warn: 'var(--c-warn)',
    bad: 'var(--c-bad)'
  }
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="color-mix(in srgb, var(--c-line2) 75%, transparent)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colors[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          style={{ transition: 'stroke-dashoffset .35s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Sparkline({
  values,
  height = 44,
  color = 'var(--c-brand)',
  className
}: {
  values: number[]
  height?: number
  color?: string
  className?: string
}): React.JSX.Element {
  const data = values.length > 1 ? values : [0, 0]
  const width = 220
  const max = Math.max(...data, 1)
  const step = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * step
    const y = height - 4 - (v / max) * (height - 10)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const area = `0,${height} ${points.join(' ')} ${width},${height}`
  const id = `spark-${Math.round(max)}-${data.length}`
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: '100%' }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function EmptyArt(): React.JSX.Element {
  return (
    <div className="grid h-28 w-28 place-items-center rounded-xl2 border border-line bg-elev/40">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--c-faint)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 4v11m0 0-4-4m4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
    </div>
  )
}

export function Stat({
  icon,
  label,
  value,
  hint,
  accent
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  hint?: ReactNode
  accent?: string
}): React.JSX.Element {
  return (
    <div className="panel relative flex items-center gap-3 overflow-hidden rounded-xl2 px-4 py-3">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-elev2"
        style={accent ? { background: accent } : undefined}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted">{label}</div>
        <div className="mt-0.5 truncate text-[18px] font-semibold leading-tight tabular">
          <span dir="ltr" className="inline-block">
            {value}
          </span>
        </div>
        {hint ? <div className="mt-0.5 text-[10.5px] text-faint">{hint}</div> : null}
      </div>
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full border transition-colors',
        checked
          ? 'border-brand/40 bg-brand/80'
          : 'border-line2 bg-elev2',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-all',
          checked ? 'start-[calc(100%-1.15rem)]' : 'start-[3px]'
        )}
      />
    </button>
  )
}
