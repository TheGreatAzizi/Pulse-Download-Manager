import { Activity, ArrowDown, ArrowUp, CircleCheck, Gauge, HardDrive } from 'lucide-react'
import { useApp } from '../state'
import { Stat, Sparkline } from './primitives'
import { cn, formatBytes, formatSpeed } from '../lib/format'

export function StatsStrip(): React.JSX.Element {
  const { t, stats, system, settings } = useApp()
  const history = (stats?.history || []).map((h) => h.down)
  const limited = settings.globalSpeedLimit > 0

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 px-5 py-3 lg:grid-cols-4">
      <Stat
        icon={<Activity size={17} className="text-brand" />}
        label={t.stats.active}
        value={stats?.activeCount ?? 0}
        hint={`${stats?.queuedCount ?? 0} ${t.stats.queued}`}
        accent="color-mix(in srgb, var(--c-brand) 14%, transparent)"
      />
      <div className="panel relative overflow-hidden rounded-xl2 shadow-[var(--shadow-panel)]">
        <div className="relative z-10 flex items-center gap-3 px-4 py-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--c-brand2) 14%, transparent)' }}
          >
            <Gauge size={17} className="text-brand2" />
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-muted">
              {t.stats.speed}
            </div>
            <div className="mt-0.5 text-[17px] font-bold leading-tight tabular">
              {formatSpeed(stats?.downSpeed ?? 0)}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-faint">
              <span className={cn('flex items-center gap-0.5', limited && 'text-warn')}>
                <ArrowDown size={10} />
                {limited ? t.stats.limited : t.stats.unlimited}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowUp size={10} />
                {formatSpeed(stats?.upSpeed ?? 0)}
              </span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-60">
          <Sparkline values={history} height={38} color="var(--c-brand2)" />
        </div>
      </div>
      <Stat
        icon={<CircleCheck size={17} className="text-ok" />}
        label={t.stats.completed}
        value={stats?.completedCount ?? 0}
        hint={`${formatBytes(stats?.totalDownloaded ?? 0)} ${t.detail.downloaded.toLowerCase()}`}
        accent="color-mix(in srgb, var(--c-ok) 13%, transparent)"
      />
      <Stat
        icon={<HardDrive size={17} className="text-warn" />}
        label={t.stats.free}
        value={formatBytes(system?.freeDisk ?? 0)}
        hint={system?.platform === 'win32' ? 'Windows' : system?.platform === 'linux' ? 'Linux' : ''}
        accent="color-mix(in srgb, var(--c-warn) 13%, transparent)"
      />
    </div>
  )
}
