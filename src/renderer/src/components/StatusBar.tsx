import { CircleCheck, Cpu, Gauge, Globe2, HardDrive, Magnet, Video as Youtube } from 'lucide-react'
import { useApp } from '../state'
import { cn, formatSpeed, isActive } from '../lib/format'

export function StatusBar(): React.JSX.Element {
  const { t, stats, tasks, settings, lang } = useApp()
  const connections = tasks.reduce((acc, task) => acc + (isActive(task) ? task.connections : 0), 0)
  const limited = settings.globalSpeedLimit > 0

  return (
    <footer className="flex h-[30px] shrink-0 items-center gap-3 border-t border-line/70 bg-panel/55 px-3 text-[9.5px] text-faint">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-1" title="yt-dlp">
          <span className={cn('h-1.5 w-1.5 rounded-full', stats?.ytdlp.available ? 'bg-ok' : 'bg-bad')} />
          <Youtube size={10} />
          yt-dlp
        </span>
        <span className="flex items-center gap-1" title="ffmpeg">
          <span className={cn('h-1.5 w-1.5 rounded-full', stats?.ffmpeg.available ? 'bg-ok' : 'bg-warn')} />
          <Cpu size={10} />
          ffmpeg
        </span>
        <span className="flex items-center gap-1" title="torrent engine">
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              stats?.torrentEngine === 'ready'
                ? 'bg-ok'
                : stats?.torrentEngine === 'starting'
                  ? 'bg-warn live-dot'
                  : 'bg-faint'
            )}
          />
          <Magnet size={10} />
          {t.statusbar.torrent}
        </span>
      </div>

      <div className="mx-1 h-3 w-px bg-line" />

      <span className="flex items-center gap-1">
        <Globe2 size={10} />
        <span className="tabular">{connections}</span>
        {t.statusbar.connections}
      </span>

      <span className="hidden items-center gap-1 sm:flex">
        <HardDrive size={10} />
        <span dir="ltr" className="max-w-[220px] truncate">
          {settings.downloadDir}
        </span>
      </span>

      <div className="ms-auto flex items-center gap-3">
        <span className={cn('flex items-center gap-1 tabular', limited && 'text-warn')}>
          <Gauge size={10} />
          {t.statusbar.limit}:{' '}
          {limited ? formatSpeed(settings.globalSpeedLimit) : t.statusbar.unlimited}
        </span>
        <span className="flex items-center gap-1 tabular text-brand2">
          <span className="h-1.5 w-1.5 rounded-full bg-brand2 live-dot" />
          {formatSpeed(stats?.downSpeed ?? 0)}
        </span>
        <span className="hidden tabular md:inline">↑ {formatSpeed(stats?.upSpeed ?? 0)}</span>
        <span className="hidden items-center gap-1 md:flex">
          <CircleCheck size={10} className="text-ok" />
          {stats?.completedCount ?? 0}
        </span>
        <span className="rounded bg-elev2/70 px-1.5 py-[1px] font-mono text-[8.5px] uppercase text-faint">
          {lang}
        </span>
      </div>
    </footer>
  )
}
