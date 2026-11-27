import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FolderOpen,
  Gauge,
  Globe2,
  Heart,
  Info,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Network,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sun,
  Wrench
} from 'lucide-react'
import type { Settings, YtdlpUpdateInfo } from '@shared/types'
import { parseProxy, proxyEndpoint } from '@shared/proxy'
import { useApp } from '../state'
import { dictionaries } from '../i18n'
import { Modal } from './Modal'
import { Logo, Toggle } from './primitives'
import { cn } from '../lib/format'

type Tab = 'general' | 'speed' | 'proxy' | 'appearance' | 'tools' | 'about'

export function SettingsModal(): React.JSX.Element {
  const {
    settingsOpen,
    setSettingsOpen,
    t,
    settings,
    stats,
    browser,
    system,
    adapters,
    refreshAdapters,
    patchSettings,
    pushToast,
    refreshTools,
    updateInfo,
    updatePhase,
    checkUpdates,
    setUpdateOpen
  } = useApp()
  const [tab, setTab] = useState<Tab>('general')
  const [draft, setDraft] = useState<Partial<Settings>>({})
  const [installing, setInstalling] = useState(false)
  const [ytdlpUpdate, setYtdlpUpdate] = useState<YtdlpUpdateInfo | null>(null)
  const [checkingYtdlp, setCheckingYtdlp] = useState(false)
  const [customLimit, setCustomLimit] = useState('')

  useEffect(() => {
    if (!settingsOpen) return
    setDraft({})
    setTab('general')
    setCustomLimit(
      settings.globalSpeedLimit ? String(+(settings.globalSpeedLimit / (1024 * 1024)).toFixed(2)) : ''
    )
  }, [settingsOpen])

  useEffect(() => {
    if (!settingsOpen || tab !== 'tools') return
    let alive = true
    setCheckingYtdlp(true)
    window.pulse
      .checkYtdlpUpdate()
      .then((info) => {
        if (alive) setYtdlpUpdate(info)
      })
      .catch(() => {
        if (alive) setYtdlpUpdate(null)
      })
      .finally(() => {
        if (alive) setCheckingYtdlp(false)
      })
    return () => {
      alive = false
    }
  }, [settingsOpen, tab])

  const merged = useMemo<Settings>(() => ({ ...settings, ...draft }), [settings, draft])
  const proxy = useMemo(() => parseProxy(String(merged.proxy || '')), [merged.proxy])

  const set = <K extends keyof Settings>(key: K, value: Settings[K]): void => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const proxyActive = proxy.ok && !!proxy.proxy
  const selectedAdapters = useMemo(() => {
    if (!adapters.length) return []
    const chosen = merged.networkAdapters
    if (!chosen.length) return adapters.map((adapter) => adapter.address)
    return adapters.filter((adapter) => chosen.includes(adapter.address)).map((adapter) => adapter.address)
  }, [adapters, merged.networkAdapters])

  const toggleAdapter = (address: string): void => {
    const current = selectedAdapters
    const next = current.includes(address)
      ? current.filter((value) => value !== address)
      : [...current, address]
    if (!next.length) {
      pushToast('info', t.settings.general.multiNetworkKeep)
      return
    }
    set('networkAdapters', next.length === adapters.length ? [] : next)
  }

  const save = (): void => {
    if (!proxy.ok) {
      pushToast('error', t.settings.proxy.errors[proxy.error])
      setTab('proxy')
      return
    }
    patchSettings({ ...draft, proxy: proxy.proxy?.url ?? '' })
    pushToast('success', dictionaries[merged.language].toast.settingsSaved)
    setSettingsOpen(false)
  }

  const chooseDir = async (): Promise<void> => {
    const chosen = await window.pulse.chooseDir(
      merged.downloadDir,
      t.add.chooseFolder,
      t.add.selectFolder
    )
    if (chosen) set('downloadDir', chosen)
  }

  const chooseCookies = async (): Promise<void> => {
    const chosen = await window.pulse.chooseCookiesFile()
    if (chosen) set('cookiesFile', chosen)
  }

  const copyExtensionPath = async (): Promise<void> => {
    const path = browser?.extensionPath
    if (!path) return
    await window.pulse.writeClipboard(path)
    pushToast('success', t.settings.tools.browserCopied)
  }

  const installYtdlp = async (): Promise<void> => {
    setInstalling(true)
    const wasInstalled = !!stats?.ytdlp.available
    try {
      const result = await window.pulse.installYtDlp()
      pushToast(
        result.ok ? 'success' : 'error',
        result.ok
          ? wasInstalled
            ? t.toast.ytdlpUpdated
            : t.toast.ytdlpInstalled
          : result.message
      )
      refreshTools()
      if (result.ok) {
        setYtdlpUpdate(null)
        setCheckingYtdlp(true)
        window.pulse
          .checkYtdlpUpdate()
          .then(setYtdlpUpdate)
          .catch(() => setYtdlpUpdate(null))
          .finally(() => setCheckingYtdlp(false))
      }
    } finally {
      setInstalling(false)
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: t.settings.tabs.general, icon: <Settings2 size={15} /> },
    { id: 'speed', label: t.settings.tabs.speed, icon: <Gauge size={15} /> },
    { id: 'proxy', label: t.settings.tabs.proxy, icon: <Network size={15} /> },
    { id: 'appearance', label: t.settings.tabs.appearance, icon: <Monitor size={15} /> },
    { id: 'tools', label: t.settings.tabs.tools, icon: <Wrench size={15} /> },
    { id: 'about', label: t.settings.tabs.about, icon: <Info size={15} /> }
  ]

  const ytdlp = stats?.ytdlp
  const ffmpeg = stats?.ffmpeg

  return (
    <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} width={1060} className="flex h-[760px] max-h-[90vh] flex-col" label={t.settings.title}>
      <div className="flex shrink-0 items-center gap-3 border-b border-line/70 px-6 py-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/12 text-brand">
          <Settings2 size={17} />
        </div>
        <div>
          <h2 className="text-[17px] font-extrabold tracking-tight">{t.settings.title}</h2>
          <p className="text-[12.5px] text-muted">{t.settings.subtitle}</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[220px] shrink-0 flex-col gap-0.5 border-e border-line/70 p-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition',
                tab === item.id ? 'bg-brand/12 text-ink' : 'text-muted hover:bg-elev2/70 hover:text-ink'
              )}
            >
              <span className={tab === item.id ? 'text-brand' : 'text-faint'}>{item.icon}</span>
              {item.label}
              <ChevronRight size={12} className={cn('ms-auto text-faint flip-x', tab === item.id ? 'opacity-100' : 'opacity-0')} />
            </button>
          ))}
          <div className="mt-auto px-1 pb-1 text-[11px] leading-relaxed text-faint">
            Pulse v{system?.appVersion ?? '1.0.0'} · {system?.platform === 'linux' ? 'Linux' : 'Windows'}
          </div>
        </div>

        <div className="scroll-y min-w-0 flex-1 p-5">
          {tab === 'general' ? (
            <div className="space-y-5">
              <Group title={t.settings.general.dir} hint={t.settings.general.dirHint}>
                <div className="flex gap-1.5">
                  <input
                    value={merged.downloadDir}
                    onChange={(e) => set('downloadDir', e.target.value)}
                    aria-label={t.settings.general.dir}
                    className="field h-9 min-w-0 flex-1 px-3 text-[12.5px]"
                    dir="ltr"
                  />
                  <button type="button" className="btn btn-ghost h-9 px-3 text-[12.5px]" onClick={() => void chooseDir()}>
                    <FolderOpen size={14} />
                    {t.add.browse}
                  </button>
                </div>
              </Group>

              <div className="grid grid-cols-2 gap-4">
                <Group title={t.settings.general.concurrent} hint={t.settings.general.concurrentHint}>
                  <Stepper
                    value={merged.maxConcurrent}
                    min={1}
                    max={10}
                    onChange={(v) => set('maxConcurrent', v)}
                  />
                </Group>
                <Group title={t.settings.general.connections} hint={t.settings.general.connectionsHint}>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={32}
                      value={merged.connections}
                      onChange={(e) => set('connections', Number(e.target.value))}
                      aria-label={t.settings.general.connections}
                      className="flex-1 accent-[var(--c-brand)]"
                    />
                    <span className="chip text-[12px]! text-brand! tabular">{merged.connections}</span>
                  </div>
                </Group>
              </div>

              <div className="overflow-hidden rounded-xl border border-line">
                <ToggleRow
                  title={t.settings.general.multiNetwork}
                  hint={
                    proxyActive
                      ? t.settings.general.multiNetworkProxy
                      : t.settings.general.multiNetworkHint
                  }
                  checked={merged.multiNetwork}
                  onChange={(v) => set('multiNetwork', v)}
                />
                {merged.multiNetwork && !proxyActive ? (
                  <div className="border-t border-line/60 px-4 pb-4 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11.5px] font-semibold text-muted">
                        {t.settings.general.multiNetworkAdapters}
                      </div>
                      <button
                        type="button"
                        onClick={() => void refreshAdapters()}
                        className="btn btn-ghost h-7 px-2 text-[10px]"
                      >
                        <RefreshCw size={11} />
                        {t.settings.general.refreshAdapters}
                      </button>
                    </div>
                    {adapters.length ? (
                      <>
                        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                          {adapters.map((adapter) => {
                            const checked = selectedAdapters.includes(adapter.address)
                            return (
                              <label
                                key={adapter.id}
                                className={cn(
                                  'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] transition',
                                  checked
                                    ? 'border-brand/40 bg-brand/8 text-ink'
                                    : 'border-line bg-elev/25 text-muted hover:border-line2'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAdapter(adapter.address)}
                                  className="h-3.5 w-3.5 accent-[var(--c-brand)]"
                                />
                                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-elev2 text-faint">
                                  <Network size={12} />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate">{adapter.device}</span>
                                  <span className="block text-[9.5px] text-faint" dir="ltr">
                                    {adapter.address}
                                  </span>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                        <p className="mt-2 text-[9.5px] text-faint">
                          {merged.networkAdapters.length === 0
                            ? t.settings.general.multiNetworkAll
                            : t.settings.general.multiNetworkCount.replace(
                                '{count}',
                                String(selectedAdapters.length)
                              )}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-[10px] leading-relaxed text-faint">
                        {t.settings.general.multiNetworkNone}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="divide-y divide-line/60 overflow-hidden rounded-xl border border-line">
                <ToggleRow
                  title={t.settings.general.autoResume}
                  hint={t.settings.general.autoResumeHint}
                  checked={merged.autoResume}
                  onChange={(v) => set('autoResume', v)}
                />
                <ToggleRow
                  title={t.settings.general.launchAtStartup}
                  hint={
                    system && !system.autoStartSupported
                      ? t.settings.general.launchAtStartupUnsupported
                      : t.settings.general.launchAtStartupHint
                  }
                  checked={merged.launchAtStartup}
                  onChange={(v) => set('launchAtStartup', v)}
                  disabled={system ? !system.autoStartSupported : false}
                />
                <ToggleRow
                  title={t.settings.general.startMinimized}
                  hint={t.settings.general.startMinimizedHint}
                  checked={merged.startMinimized}
                  onChange={(v) => set('startMinimized', v)}
                  disabled={system ? !system.autoStartSupported : false}
                />
                <ToggleRow
                  title={t.settings.general.notify}
                  checked={merged.notifyOnComplete}
                  onChange={(v) => set('notifyOnComplete', v)}
                />
                <ToggleRow
                  title={t.settings.general.clipboard}
                  hint={t.settings.general.clipboardHint}
                  checked={merged.clipboardWatch}
                  onChange={(v) => set('clipboardWatch', v)}
                />
                <ToggleRow
                  title={t.settings.tools.seed}
                  checked={merged.seedAfterComplete}
                  onChange={(v) => set('seedAfterComplete', v)}
                />
              </div>
            </div>
          ) : null}

          {tab === 'speed' ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-elev/30 p-4">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <Gauge size={16} className="text-brand" />
                  {t.settings.speed.title}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.settings.speed.desc}</p>
                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  {[
                    { value: 0, label: t.settings.speed.unlimited },
                    { value: 1024 * 1024, label: '1 MB/s' },
                    { value: 2 * 1024 * 1024, label: '2 MB/s' },
                    { value: 5 * 1024 * 1024, label: '5 MB/s' },
                    { value: 10 * 1024 * 1024, label: '10 MB/s' },
                    { value: 25 * 1024 * 1024, label: '25 MB/s' }
                  ].map((preset) => {
                    const active = merged.globalSpeedLimit === preset.value
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => {
                          set('globalSpeedLimit', preset.value)
                          setCustomLimit(preset.value ? String(preset.value / (1024 * 1024)) : '')
                        }}
                        className={cn(
                          'rounded-lg border px-2 py-2 text-[12.5px] transition',
                          active
                            ? 'border-brand/50 bg-brand/10 font-semibold text-brand'
                            : 'border-line bg-panel/40 text-muted hover:border-line2 hover:text-ink'
                        )}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <div className="flex-1">
                    <div className="mb-1 text-[11.5px] font-semibold text-muted">{t.settings.speed.custom}</div>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={customLimit}
                        onChange={(e) => {
                          setCustomLimit(e.target.value)
                          const n = Number(e.target.value)
                          set('globalSpeedLimit', Number.isFinite(n) && n > 0 ? Math.round(n * 1024 * 1024) : 0)
                        }}
                        placeholder="0"
                        aria-label={t.settings.speed.custom}
                        className="field h-9 w-full px-3 pe-16 text-[13px] tabular"
                        dir="ltr"
                      />
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-[11px] text-faint">
                        MB/s
                      </span>
                    </div>
                  </div>
                  <div className="pb-2 text-[11.5px] text-faint">{t.settings.speed.note}</div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'proxy' ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-line bg-elev/30 p-4">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <Network size={16} className="text-brand" />
                  {t.settings.proxy.title}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t.settings.proxy.desc}</p>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11.5px] font-semibold text-muted">
                    {t.settings.proxy.address}
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      value={merged.proxy}
                      onChange={(e) => set('proxy', e.target.value)}
                      placeholder={t.settings.proxy.placeholder}
                      aria-label={t.settings.proxy.address}
                      className={cn(
                        'field h-9 min-w-0 flex-1 px-3 text-[13px]',
                        !proxy.ok && 'border-bad/60'
                      )}
                      dir="ltr"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      onClick={() => set('proxy', '')}
                      disabled={!merged.proxy}
                      className="btn btn-ghost h-9 shrink-0 px-2.5 text-[11.5px] disabled:opacity-40"
                    >
                      {t.settings.proxy.clear}
                    </button>
                  </div>
                </label>
                <div className="mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed">
                  {!proxy.ok ? (
                    <>
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-bad" />
                      <span className="text-bad">{t.settings.proxy.errors[proxy.error]}</span>
                    </>
                  ) : proxy.proxy ? (
                    <>
                      <ShieldCheck size={12} className="mt-0.5 shrink-0 text-ok" />
                      <span className="text-ok">
                        {t.settings.proxy.active}:{' '}
                        <span dir="ltr" className="font-medium">
                          {proxyEndpoint(proxy.proxy)}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <Globe2 size={12} className="mt-0.5 shrink-0 text-faint" />
                      <span className="text-faint">{t.settings.proxy.direct}</span>
                    </>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{t.settings.proxy.hint}</p>
              </div>

              <div className="rounded-xl border border-line bg-elev/25 p-3">
                <div className="flex items-center gap-2 text-[12.5px] font-semibold">
                  <ShieldCheck size={13} className="text-faint" />
                  {t.settings.proxy.scopeTitle}
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-faint">{t.settings.proxy.scope}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">{t.settings.proxy.authHint}</p>
                <div className="mt-2 rounded-lg border border-line/70 bg-panel/40 px-2.5 py-2">
                  <div className="text-[10.5px] font-semibold text-muted">
                    {t.settings.proxy.examplesLabel}
                  </div>
                  <div className="mt-1 text-[11px] leading-relaxed text-faint" dir="ltr">
                    {t.settings.proxy.examples}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'appearance' ? (
            <div className="space-y-5">
              <Group title={t.settings.appearance.theme}>
                <div className="grid grid-cols-2 gap-2">
                  <ThemeCard
                    active={merged.theme === 'dark'}
                    label={t.settings.appearance.dark}
                    icon={<Moon size={16} />}
                    preview={{ bg: '#0d1017', bar: 'rgba(255,255,255,0.16)', accent: '#4a7df0' }}
                    onClick={() => set('theme', 'dark')}
                  />
                  <ThemeCard
                    active={merged.theme === 'light'}
                    label={t.settings.appearance.light}
                    icon={<Sun size={16} />}
                    preview={{ bg: '#ffffff', bar: 'rgba(15,23,42,0.14)', accent: '#2f5fd0' }}
                    onClick={() => set('theme', 'light')}
                  />
                </div>
              </Group>

              <Group title={t.settings.appearance.language} hint={t.settings.appearance.direction}>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => set('language', 'fa')}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-3 text-[14px] transition',
                      merged.language === 'fa'
                        ? 'border-brand/50 bg-brand/10 font-semibold text-brand'
                        : 'border-line bg-elev/25 text-muted hover:border-line2'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Globe2 size={15} />
                      {t.settings.appearance.persian}
                    </span>
                    {merged.language === 'fa' ? <Check size={15} /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => set('language', 'en')}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-3 text-[14px] transition',
                      merged.language === 'en'
                        ? 'border-brand/50 bg-brand/10 font-semibold text-brand'
                        : 'border-line bg-elev/25 text-muted hover:border-line2'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Globe2 size={15} />
                      {t.settings.appearance.english}
                    </span>
                    {merged.language === 'en' ? <Check size={15} /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => set('language', 'ja')}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-3 text-[14px] transition',
                      merged.language === 'ja'
                        ? 'border-brand/50 bg-brand/10 font-semibold text-brand'
                        : 'border-line bg-elev/25 text-muted hover:border-line2'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Globe2 size={15} />
                      {t.settings.appearance.japanese}
                    </span>
                    {merged.language === 'ja' ? <Check size={15} /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => set('language', 'ru')}
                    className={cn(
                      'flex items-center justify-between rounded-xl border px-3 py-3 text-[14px] transition',
                      merged.language === 'ru'
                        ? 'border-brand/50 bg-brand/10 font-semibold text-brand'
                        : 'border-line bg-elev/25 text-muted hover:border-line2'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Globe2 size={15} />
                      {t.settings.appearance.russian}
                    </span>
                    {merged.language === 'ru' ? <Check size={15} /> : null}
                  </button>
                </div>
              </Group>
            </div>
          ) : null}

          {tab === 'tools' ? (
            <div className="space-y-3">
              <ToolCard
                title={t.settings.tools.ytdlp}
                desc={t.settings.tools.ytdlpDesc}
                ready={!!ytdlp?.available}
                version={ytdlp?.version}
                path={ytdlp?.path}
                t={t}
                action={
                  !ytdlp?.available ? (
                    <button
                      type="button"
                      onClick={() => void installYtdlp()}
                      disabled={installing}
                      className="btn btn-soft h-8 px-2.5 text-[12px]"
                    >
                      {installing ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                      {installing ? t.settings.tools.installing : t.settings.tools.install}
                    </button>
                  ) : installing ? (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-faint">
                      <Loader2 size={12} className="animate-spin" /> {t.settings.tools.updating}
                    </span>
                  ) : checkingYtdlp ? (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-faint">
                      <Loader2 size={12} className="animate-spin" /> {t.settings.tools.checkingUpdate}
                    </span>
                  ) : ytdlpUpdate?.hasUpdate ? (
                    <button
                      type="button"
                      onClick={() => void installYtdlp()}
                      className="btn btn-soft h-8 px-2.5 text-[12px]"
                    >
                      <Download size={12} />
                      {t.settings.tools.updateTo.replace('{version}', ytdlpUpdate.latest || '')}
                    </button>
                  ) : !ytdlpUpdate ? (
                    <button
                      type="button"
                      onClick={() => void installYtdlp()}
                      className="btn btn-soft h-8 px-2.5 text-[12px]"
                    >
                      <Download size={12} />
                      {t.settings.tools.update}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                      <Check size={12} /> {t.settings.tools.upToDate}
                    </span>
                  )
                }
              />
              <ToolCard
                title={t.settings.tools.ffmpeg}
                desc={t.settings.tools.ffmpegDesc}
                ready={!!ffmpeg?.available}
                path={ffmpeg?.path}
                t={t}
                action={
                  ffmpeg?.available ? (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                      <Check size={12} /> {t.settings.tools.available}
                    </span>
                  ) : (
                    <span className="text-[11.5px] font-semibold text-bad">{t.settings.tools.missing}</span>
                  )
                }
              />
              <ToolCard
                title={t.settings.tools.torrent}
                desc={t.settings.tools.torrentDesc}
                ready={stats?.torrentEngine === 'ready'}
                t={t}
                extra={
                  <div className="flex items-center gap-2">
                    <span className="text-[11.5px] text-faint">{t.settings.tools.port}</span>
                    <input
                      type="number"
                      value={merged.torrentPort}
                      onChange={(e) => set('torrentPort', Number(e.target.value) || 51413)}
                      aria-label={t.settings.tools.port}
                      className="field h-7 w-[76px] px-2 text-[12px] tabular"
                      dir="ltr"
                    />
                  </div>
                }
                action={
                  stats?.torrentEngine === 'ready' ? (
                    <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                      <Check size={12} /> {t.settings.tools.engineReady}
                    </span>
                  ) : (
                    <span className="text-[11.5px] font-semibold text-warn">
                      {stats?.torrentEngine === 'starting' ? t.add.analyzing : t.settings.tools.engineIdle}
                    </span>
                  )
                }
              />
              <div className="rounded-xl border border-line bg-elev/25 p-3">
                <div className="flex items-start gap-2.5">
                  <Globe2 size={13} className="mt-0.5 shrink-0 text-faint" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold">{t.settings.tools.browser}</span>
                      <span
                        className={cn(
                          'text-[11px] font-semibold',
                          browser?.running ? 'text-ok' : 'text-faint'
                        )}
                      >
                        {browser?.running
                          ? t.settings.tools.browserRunning.replace('{port}', String(browser.port))
                          : t.settings.tools.browserStopped}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                      {t.settings.tools.browserDesc}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void window.pulse.openExtensionFolder()}
                        className="btn btn-ghost h-7 px-2 text-[11.5px]"
                      >
                        <FolderOpen size={11} />
                        {t.settings.tools.browserFolder}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyExtensionPath()}
                        className="btn btn-ghost h-7 px-2 text-[11.5px]"
                      >
                        <Copy size={11} />
                        {t.settings.tools.browserCopyPath}
                      </button>
                      <span className="text-[11px] text-faint">
                        {browser?.running
                          ? browser.clients > 0
                            ? t.settings.tools.browserClients.replace(
                                '{count}',
                                String(browser.clients)
                              )
                            : t.settings.tools.browserNoClients
                          : t.settings.tools.browserInstall}
                      </span>
                    </div>
                    <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                      {t.settings.tools.browserInstallHint}
                    </p>
                    <div className="mt-1 truncate text-[10.5px] text-faint" dir="ltr">
                      {browser?.extensionPath || ''}
                    </div>
                    {browser?.error ? (
                      <p className="mt-1 text-[11px] text-bad">{browser.error}</p>
                    ) : null}
                  </div>
                  <Toggle
                    checked={merged.browserIntegration}
                    onChange={(value) => set('browserIntegration', value)}
                    label={t.settings.tools.browserEnabled}
                  />
                </div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                  {t.settings.tools.browserEnabledHint}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-elev/25 p-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-faint" />
                  <span className="text-[12.5px] font-semibold">{t.settings.tools.youtubeAuth}</span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-faint">{t.settings.tools.youtubeAuthHint}</p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-faint">{t.settings.tools.cookiesBrowser}</span>
                    <select
                      value={merged.cookiesBrowser}
                      onChange={(e) => set('cookiesBrowser', e.target.value as Settings['cookiesBrowser'])}
                      className="field h-8 w-full px-2 text-[12px]"
                      dir="ltr"
                    >
                      <option value="">{t.settings.tools.noCookies}</option>
                      <option value="chrome">Chrome</option>
                      <option value="edge">Edge</option>
                      <option value="firefox">Firefox</option>
                      <option value="brave">Brave</option>
                      <option value="opera">Opera</option>
                      <option value="vivaldi">Vivaldi</option>
                      <option value="chromium">Chromium</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-faint">{t.settings.tools.cookiesFile}</span>
                    <div className="flex gap-1.5">
                      <input
                        value={merged.cookiesFile}
                        onChange={(e) => set('cookiesFile', e.target.value)}
                        placeholder="cookies.txt"
                        className="field h-8 min-w-0 flex-1 px-2 text-[12px]"
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => void chooseCookies()}
                        className="btn btn-ghost h-8 px-2 text-[11.5px]"
                        title={t.settings.tools.chooseCookies}
                      >
                        <FolderOpen size={12} />
                      </button>
                    </div>
                  </label>
                </div>
                <p className="mt-1.5 text-[10.5px] leading-relaxed text-faint">
                  {t.settings.tools.cookiesFileHint} {t.settings.tools.cookiesBrowserHint}
                </p>
              </div>
              <div className="rounded-xl border border-line bg-elev/25 p-3">
                <div className="flex items-center gap-2">
                  <KeyRound size={13} className="text-faint" />
                  <span className="text-[12.5px] font-semibold">{t.settings.tools.githubToken}</span>
                  <button
                    type="button"
                    onClick={() =>
                      void window.pulse.openExternal(
                        'https://github.com/settings/tokens/new?scopes=public_repo&description=Pulse'
                      )
                    }
                    className="ms-auto flex items-center gap-1 text-[11px] text-brand transition hover:underline"
                  >
                    <ExternalLink size={10} />
                    github.com
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-faint">
                  {t.settings.tools.githubTokenHint}
                </p>
                <input
                  type="password"
                  value={merged.githubToken}
                  onChange={(e) => set('githubToken', e.target.value)}
                  placeholder={t.settings.tools.githubTokenPlaceholder}
                  aria-label={t.settings.tools.githubToken}
                  className="field mt-2 h-8 w-full px-2 text-[12px]"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line bg-elev/25 px-3 py-2.5">
                <div className="flex items-center gap-2 text-[12.5px] text-muted">
                  <Cpu size={13} className="text-faint" />
                  {t.settings.tools.path}
                </div>
                <button
                  type="button"
                  onClick={() => refreshTools()}
                  className="btn btn-ghost h-7 px-2 text-[11.5px]"
                >
                  <RefreshCw size={11} />
                  {t.settings.tools.rescan}
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'about' ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Logo size={64} glow={false} />
              <h3 className="mt-4 text-[22px] font-semibold tracking-tight">Pulse Download Manager</h3>
              <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{t.settings.about.built}</p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <span className="chip"><Activity size={10} /> HTTP ×{merged.connections}</span>
                <span className="chip"><Globe2 size={10} /> yt-dlp</span>
                <span className="chip"><Activity size={10} /> BitTorrent</span>
                <span className="chip"><Moon size={10} /> RTL</span>
              </div>
              <p className="mt-3 max-w-md text-[12px] leading-relaxed text-faint">{t.settings.about.features}</p>
              <button
                type="button"
                onClick={() => window.pulse.openExternal('https://daramet.com/AziziWarmCorner')}
                className="btn btn-soft mt-4 h-10 gap-2 px-5 text-[13px]"
              >
                <Heart size={15} className="text-brand" />
                {t.settings.about.support}
              </button>
              <div className="mt-5 w-full max-w-sm divide-y divide-line/60 overflow-hidden rounded-xl border border-line text-start">
                <Row label={t.settings.about.version} value={system?.appVersion ?? '1.0.0'} />
                <Row label={t.settings.about.platform} value={`${system?.platform} ${system?.version}`} />
                <Row label={t.settings.about.electron} value={`Electron ${system?.runtime?.electron ?? ''}`} />
                <LinkRow
                  label={t.settings.about.repository}
                  value="TheGreatAzizi/Pulse-Download-Manager"
                  onClick={() =>
                    window.pulse.openExternal('https://github.com/TheGreatAzizi/Pulse-Download-Manager')
                  }
                />
                <LinkRow
                  label={t.settings.about.license}
                  value="GPL-3.0-or-later"
                  onClick={() =>
                    window.pulse.openExternal(
                      'https://github.com/TheGreatAzizi/Pulse-Download-Manager/blob/main/LICENSE'
                    )
                  }
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[11.5px] text-faint">{t.settings.about.updates}</div>
                    <div
                      className={cn(
                        'mt-0.5 truncate text-[11.5px] font-medium',
                        updateInfo?.hasUpdate ? 'text-brand' : 'text-muted'
                      )}
                    >
                      {updatePhase === 'checking'
                        ? t.settings.about.checking
                        : updateInfo?.hasUpdate
                          ? t.update.available.replace('{version}', updateInfo.latest)
                          : updateInfo
                            ? t.settings.about.upToDate
                            : system
                              ? `v${system.appVersion}`
                              : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (updateInfo?.hasUpdate) setUpdateOpen(true)
                      else void checkUpdates()
                    }}
                    disabled={updatePhase === 'checking'}
                    className="btn btn-ghost h-7 shrink-0 px-2.5 text-[11.5px]"
                  >
                    <RefreshCw size={11} className={cn(updatePhase === 'checking' && 'animate-spin')} />
                    {updateInfo?.hasUpdate ? t.toast.viewUpdate : t.settings.about.checkUpdates}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line/70 bg-panel/60 px-5 py-3">
        <button type="button" className="btn btn-ghost h-9 px-3.5 text-[13px]" onClick={() => setSettingsOpen(false)}>
          {t.settings.close}
        </button>
        {tab !== 'about' ? (
          <button type="button" className="btn btn-primary h-9 px-4 text-[13px]" onClick={save}>
            <Check size={14} />
            {t.settings.save}
          </button>
        ) : null}
      </div>
    </Modal>
  )
}

function Group({
  title,
  hint,
  children
}: {
  title: string
  hint?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold">{title}</span>
        {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

function Stepper({
  value,
  min,
  max,
  onChange
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}): React.JSX.Element {
  const { t } = useApp()
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={t.common.decrease}
        className="icon-btn h-8! w-8! border border-line text-[16px]"
      >
        −
      </button>
      <div className="field flex h-8 flex-1 items-center justify-center text-[14px] font-semibold tabular">
        {value}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={t.common.increase}
        className="icon-btn h-8! w-8! border border-line text-[16px]"
      >
        +
      </button>
    </div>
  )
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
  disabled
}: {
  title: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-medium">{title}</div>
        {hint ? <div className="mt-0.5 text-[11px] text-faint">{hint}</div> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  )
}

function ThemeCard({
  active,
  label,
  icon,
  preview,
  onClick
}: {
  active: boolean
  label: string
  icon: React.ReactNode
  preview: { bg: string; bar: string; accent: string }
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex items-center gap-3 rounded-xl border p-2.5 text-start transition',
        active ? 'border-brand/50 bg-brand/8' : 'border-line bg-elev/25 hover:border-line2'
      )}
    >
      <div
        className="relative h-11 w-16 overflow-hidden rounded-lg border border-line2"
        style={{ background: preview.bg }}
      >
        <div
          className="absolute inset-x-1.5 top-1.5 h-1 rounded-full"
          style={{ background: preview.bar }}
        />
        <div
          className="absolute inset-x-1.5 top-3.5 h-1 rounded-full"
          style={{ background: preview.bar }}
        />
        <div
          className="absolute inset-x-1.5 top-5.5 h-1 rounded-full"
          style={{ background: preview.accent }}
        />
      </div>
      <div className="flex-1">
        <div className={cn('flex items-center gap-1.5 text-[13px] font-semibold', active && 'text-brand')}>
          {icon}
          {label}
        </div>
        {active ? <div className="mt-0.5 text-[11px] text-brand/80">active</div> : null}
      </div>
    </button>
  )
}

function ToolCard({
  title,
  desc,
  ready,
  version,
  path,
  action,
  extra,
  t
}: {
  title: string
  desc: string
  ready: boolean
  version?: string
  path?: string
  action?: React.ReactNode
  extra?: React.ReactNode
  t: ReturnType<typeof useApp>['t']
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-line bg-elev/25 p-3">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-1 h-2 w-2 shrink-0 rounded-full',
            ready ? 'bg-ok' : 'bg-faint'
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold">{title}</span>
            {version ? <span className="chip py-0! text-[10.5px]!">v{version}</span> : null}
            <span className={cn('text-[11px] font-semibold', ready ? 'text-ok' : 'text-faint')}>
              {ready ? t.settings.tools.available : t.settings.tools.missing}
            </span>
          </div>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{desc}</p>
          {path ? (
            <div className="mt-1 truncate text-[10.5px] text-faint" dir="ltr">
              {path}
            </div>
          ) : null}
          {extra ? <div className="mt-2">{extra}</div> : null}
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[11.5px] text-faint">{label}</span>
      <span className="max-w-[60%] truncate text-[11.5px] font-medium text-muted" dir="ltr">
        {value}
      </span>
    </div>
  )
}

function LinkRow({
  label,
  value,
  onClick
}: {
  label: string
  value: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between px-3 py-2 text-start transition hover:bg-elev/50"
    >
      <span className="text-[11.5px] text-faint">{label}</span>
      <span className="flex max-w-[60%] items-center gap-1 text-[11.5px] font-medium text-brand" dir="ltr">
        <span className="truncate">{value}</span>
        <ExternalLink size={10} className="shrink-0" />
      </span>
    </button>
  )
}
