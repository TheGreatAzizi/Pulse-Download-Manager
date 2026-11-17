import { Activity, ArrowDown, ArrowUp, CircleCheck, Gauge, HardDrive } from 'lucide-react'
import { useApp } from '../state'
import { Stat, Sparkline } from './primitives'
import { cn, formatBytes, formatSpeed } from '../lib/format'

export function StatsStrip(): React.JSX.Element {
  const { t, stats, system, settings } = useApp()
  const history = (stats?.history || []).map((h) => h.down)
  const limited = settings.globalSpeedLimit > 0

  return (
    <div className="grid shrink-0 grid-cols-2 gap-2.5 px-5 py-3 lg:grid-cols-[1fr_1.35fr_1fr_1fr]">
      <Stat
        icon={<Activity size={17} className="text-brand" />}
        label={t.stats.active}
        value={stats?.activeCount ?? 0}
        hint={`${stats?.queuedCount ?? 0} ${t.stats.queued}`}
      />
      <div className="panel relative overflow-hidden rounded-xl2">
        <div className="relative z-10 flex items-center gap-3 px-4 py-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-elev2">
            <Gauge size={17} className="text-brand" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-muted">{t.stats.speed}</div>
            <div className="mt-0.5 text-[18px] font-semibold leading-tight tabular">
              <span dir="ltr" className="inline-block">
                {formatSpeed(stats?.downSpeed ?? 0)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-faint">
              <span className={cn('flex items-center gap-0.5', limited && 'text-warn')}>
                <ArrowDown size={10} />
                {limited ? t.stats.limited : t.stats.unlimited}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowUp size={10} />
                <span dir="ltr" className="inline-block">
                  {formatSpeed(stats?.upSpeed ?? 0)}
                </span>
              </span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-50">
          <Sparkline values={history} height={38} color="var(--c-brand)" />
        </div>
      </div>
      <Stat
        icon={<CircleCheck size={17} className="text-ok" />}
        label={t.stats.completed}
        value={stats?.completedCount ?? 0}
        hint={
          <>
            <span dir="ltr" className="inline-block">
              {formatBytes(stats?.totalDownloaded ?? 0)}
            </span>{' '}
            {t.detail.downloaded.toLowerCase()}
          </>
        }
      />
      <Stat
        icon={<HardDrive size={17} className="text-muted" />}
        label={t.stats.free}
        value={formatBytes(system?.freeDisk ?? 0)}
        hint={system?.platform === 'win32' ? 'Windows' : system?.platform === 'linux' ? 'Linux' : ''}
      />
    </div>
  )
}
