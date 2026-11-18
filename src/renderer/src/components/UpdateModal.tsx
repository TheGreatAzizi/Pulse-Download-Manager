import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  Rocket,
  Sparkles
} from 'lucide-react'
import { useApp } from '../state'
import { Modal } from './Modal'
import { cn, formatBytes } from '../lib/format'

export function UpdateModal(): React.JSX.Element {
  const {
    t,
    system,
    updateInfo,
    updatePhase,
    updateProgress,
    updateError,
    updatePath,
    updateOpen,
    setUpdateOpen,
    checkUpdates,
    downloadUpdate,
    installUpdate,
    revealUpdate
  } = useApp()

  const close = (): void => {
    setUpdateOpen(false)
  }

  const percent =
    updateProgress && updateProgress.total > 0
      ? Math.min(100, Math.round((updateProgress.received / updateProgress.total) * 100))
      : 0

  const hasUpdate = Boolean(updateInfo?.hasUpdate)
  const ready = updatePhase === 'ready'
  const assetSize = updateInfo?.asset?.size ?? 0

  return (
    <Modal open={updateOpen} onClose={close} width={520} label={t.update.title}>
      <div className="flex items-start gap-3 px-6 pb-4 pt-5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          {hasUpdate ? <Sparkles size={19} /> : <RefreshCw size={18} />}
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight">{t.update.title}</h2>
          <p className="text-[10.5px] text-muted">
            {t.update.current} {updateInfo?.current ?? system?.appVersion ?? ''}
          </p>
        </div>
      </div>

      <div className="border-t border-line/70 px-6 py-4">
        {updatePhase === 'error' ? (
          <div className="flex items-start gap-2 rounded-xl border border-bad/25 bg-bad/8 px-3 py-2.5 text-[11px] text-bad">
            <AlertCircle size={14} className="mt-[1px] shrink-0" />
            <span className="min-w-0 flex-1">{updateError || t.settings.about.updateFailed}</span>
          </div>
        ) : updatePhase === 'checking' ? (
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <Loader2 size={15} className="animate-spin" />
            {t.settings.about.checking}
          </div>
        ) : hasUpdate ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-ok/15 text-ok">
                <Check size={12} strokeWidth={3} />
              </span>
              <span className="text-[12px] font-semibold">
                {t.update.available.replace('{version}', updateInfo?.latest ?? '')}
              </span>
            </div>

            {updateInfo?.notes ? (
              <div className="scroll-y max-h-40 whitespace-pre-wrap rounded-xl border border-line bg-elev/25 px-3 py-2.5 text-[10.5px] leading-relaxed text-muted">
                {updateInfo.notes}
              </div>
            ) : null}

            {ready ? (
              <div className="flex items-start gap-2 rounded-xl border border-ok/25 bg-ok/8 px-3 py-2.5 text-[11px] text-ok">
                <Check size={14} className="mt-[1px] shrink-0" />
                <div className="min-w-0">
                  <div>{t.update.downloaded}</div>
                  {updatePath ? (
                    <div className="mt-0.5 truncate text-[9px] text-ok/70" dir="ltr" title={updatePath}>
                      {updatePath}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : updatePhase === 'downloading' ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-muted">
                  <span>{t.update.downloading}</span>
                  <span className="tabular">{percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-elev2">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
                </div>
                {assetSize > 0 ? (
                  <div className="text-[9px] text-faint tabular">
                    {formatBytes(updateProgress?.received ?? 0)} / {formatBytes(assetSize)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-[10.5px] leading-relaxed text-muted">
                {updateInfo?.canInstall ? t.update.installHint : t.update.manualHint}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11.5px] text-muted">
            <Check size={15} className="text-ok" strokeWidth={3} />
            {t.settings.about.upToDate}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-line/70 bg-panel/60 px-6 py-3">
        <button
          type="button"
          onClick={() => void checkUpdates()}
          disabled={updatePhase === 'checking' || updatePhase === 'downloading'}
          className="btn btn-ghost h-9 px-3 text-[11px]"
        >
          <RefreshCw size={13} className={cn(updatePhase === 'checking' && 'animate-spin')} />
          {t.settings.about.checkUpdates}
        </button>
        <div className="ms-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              updateInfo?.releaseUrl && void window.pulse.openExternal(updateInfo.releaseUrl)
            }
            className="btn btn-ghost h-9 px-3 text-[11px]"
          >
            <ExternalLink size={13} />
            {t.update.releaseNotes}
          </button>
          {hasUpdate ? (
            ready ? (
              updateInfo?.canInstall ? (
                <button
                  type="button"
                  onClick={() => void installUpdate()}
                  className="btn btn-primary h-9 min-w-[132px] px-4 text-[11.5px]"
                >
                  <Rocket size={14} />
                  {t.update.restartInstall}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void revealUpdate()}
                  className="btn btn-primary h-9 min-w-[132px] px-4 text-[11.5px]"
                >
                  <FolderOpen size={14} />
                  {t.update.showFile}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => void downloadUpdate()}
                disabled={updatePhase === 'downloading' || !updateInfo?.asset}
                className="btn btn-primary h-9 min-w-[132px] px-4 text-[11.5px]"
              >
                {updatePhase === 'downloading' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {updateInfo?.canInstall ? t.update.downloadInstall : t.update.download}
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={close}
              className="btn btn-primary h-9 min-w-[100px] px-4 text-[11.5px]"
            >
              {t.common.close}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
