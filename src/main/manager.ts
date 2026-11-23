import { Notification, app, nativeTheme, shell, clipboard } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import { basename, join, relative, isAbsolute } from 'node:path'
import type {
  AddDownloadInput,
  AddTorrentInput,
  DownloadQueue,
  DownloadTask,
  GlobalStats,
  Language,
  MainEvent,
  ProbeResult,
  ResumeWithUrlResult,
  Settings,
  SpeedSample,
  TaskKind,
  TaskStatus
} from '@shared/types'
import { Store } from './store'
import {
  GlobalThrottle,
  categoryFor,
  ensureDir,
  guessNameFromUrl,
  isYoutubeUrl,
  sanitizeFileName
} from './util'
import { HttpEngine, type EngineHost, type TaskHandle } from './engines/http'
import { YoutubeEngine } from './engines/youtube'
import { TorrentEngine } from './engines/torrent'
import { applyLaunchAtStartup } from './autostart'
import { configureProxy, disposeProxy } from './proxy'
import { parseProxy } from '@shared/proxy'
import { manifestKind } from '@shared/urls'
import { normalizeQueues, queueWindow, resolveQueueId } from '@shared/queues'

interface ManagerDeps {
  store: Store
  emit: (event: MainEvent) => void
}

const ACTIVE: TaskStatus[] = ['connecting', 'downloading', 'verifying']
const RESUMABLE: TaskStatus[] = ['paused', 'error', 'canceled']

const NOTIFICATION_COPY: Record<Language, { complete: string; failed: string }> = {
  en: { complete: 'Download complete', failed: 'Download failed' },
  fa: { complete: 'دانلود کامل شد', failed: 'دانلود ناموفق بود' },
  ja: { complete: 'ダウンロード完了', failed: 'ダウンロード失敗' },
  ru: { complete: 'Загрузка завершена', failed: 'Ошибка загрузки' }
}

/** A readable name for a manifest URL that has no page title. */
function manifestTitle(url: string): string {
  try {
    const parsed = new URL(url)
    const base = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
      .replace(/\.(m3u8|mpd)$/i, '')
      .trim()
    if (base && !/^(master|index|playlist|manifest|stream|video|main)$/i.test(base)) return base
    return parsed.hostname.replace(/^www\./i, '') || 'video'
  } catch {
    return 'video'
  }
}

export class DownloadManager implements EngineHost {
  readonly store: Store
  readonly http: HttpEngine
  readonly youtube: YoutubeEngine
  readonly torrent: TorrentEngine
  readonly throttle = new GlobalThrottle()
  private emit: (event: MainEvent) => void
  private tasks = new Map<string, DownloadTask>()
  private controllers = new Map<string, AbortController>()
  private autoNames = new Set<string>()
  private resumeFlags = new Set<string>()
  private lastDownloaded = new Map<string, number>()
  private history: SpeedSample[] = []
  private ticker: NodeJS.Timeout | null = null
  private toolStatus = {
    ytdlp: { available: false } as { available: boolean; version?: string; path?: string },
    ffmpeg: { available: false } as { available: boolean; path?: string }
  }
  private shuttingDown = false
  private lastStatsEmit = 0
  private torrentPayloads = new Map<string, { data?: Buffer; file?: number[] }>()
  /** Tasks paused by a queue schedule, so they resume when the queue opens. */
  private queueHold = new Set<string>()
  private queueOpenState = new Map<string, boolean>()
  private queueTimer: NodeJS.Timeout | null = null
  private queueArmedAt = 0

  constructor(deps: ManagerDeps) {
    this.store = deps.store
    this.emit = deps.emit
    this.http = new HttpEngine(this)
    this.youtube = new YoutubeEngine(this)
    this.torrent = new TorrentEngine(this)
  }

  settings(): Settings {
    return this.store.settings
  }

  queues(): DownloadQueue[] {
    return normalizeQueues(this.store.settings.queues)
  }

  async init(): Promise<void> {
    const saved = this.store.tasks
    const autoResume = this.store.settings.autoResume
    for (const raw of saved) {
      const task: DownloadTask = {
        ...raw,
        speed: 0,
        eta: 0,
        connections: 0,
        error: raw.status === 'error' ? raw.error : undefined
      }
      const interrupted = !!task.resumeOnStart
      delete task.resumeOnStart
      if (ACTIVE.includes(task.status) || task.status === 'queued') {
        if (task.status === 'queued' || autoResume) {
          task.status = 'queued'
        } else {
          task.status = 'paused'
        }
      } else if (interrupted && autoResume && task.status === 'paused') {
        task.status = 'queued'
      }
      this.tasks.set(task.id, task)
      this.lastDownloaded.set(task.id, task.downloaded)
      if (task.heldByQueue) this.queueHold.add(task.id)
    }
    this.throttle.setLimit(this.store.settings.globalSpeedLimit)
    this.ticker = setInterval(() => this.tick(), 1000)
    void this.refreshTools()
    void this.torrent.init().catch(() => undefined)
    if (this.store.settings.globalSpeedLimit > 0) {
      this.torrent.setLimit(this.store.settings.globalSpeedLimit)
    }
    this.persistSoon()
    // Give the torrent engine a moment to come up, then apply queue gates.
    setTimeout(() => {
      if (this.shuttingDown) return
      this.enforceQueueSchedules()
      this.schedule()
      this.armQueueTimer()
    }, 700)
  }

  private async refreshTools(): Promise<void> {
    try {
      const status = await this.youtube.status()
      this.toolStatus = status
    } catch {
      this.toolStatus = {
        ytdlp: { available: false },
        ffmpeg: { available: false }
      }
    }
    this.emitStats(true)
  }

  list(): DownloadTask[] {
    return [...this.tasks.values()].sort((a, b) => b.order - a.order)
  }

  get(id: string): DownloadTask | undefined {
    return this.tasks.get(id)
  }

  patch(task: DownloadTask, patch: Partial<DownloadTask>): void {
    const wasCompleted = task.status === 'completed'
    const previousStatus = task.status
    Object.assign(task, patch)
    task.updatedAt = Date.now()
    if (patch.fileName && this.autoNames.has(task.id)) task.name = patch.fileName
    if (patch.fileName) task.category = categoryFor(patch.fileName)
    if (previousStatus !== task.status) {
      if (task.status === 'completed') this.handleCompleted(task)
      else if (task.status === 'error') this.notifyResult(task, 'failed')
    }
    this.persistSoon()
    this.emit({ type: 'task:update', task })
    if (wasCompleted !== (task.status === 'completed')) this.emitStats(true)
  }

  private notifyResult(task: DownloadTask, outcome: 'complete' | 'failed'): void {
    if (!this.store.settings.notifyOnComplete || !Notification.isSupported()) return
    const copy = NOTIFICATION_COPY[this.store.settings.language] || NOTIFICATION_COPY.en
    const detail = outcome === 'failed' ? (task.error || '').replace(/\s+/g, ' ').trim() : ''
    try {
      new Notification({
        title: outcome === 'failed' ? copy.failed : copy.complete,
        body: detail ? `${task.name}\n${detail.slice(0, 180)}` : task.name,
        silent: false
      }).show()
    } catch {
      /* notifications are best effort */
    }
  }

  private handleCompleted(task: DownloadTask): void {
    task.speed = 0
    task.eta = 0
    task.connections = 0
    this.notifyResult(task, 'complete')
    void this.store.flush()
  }

  toast(level: 'info' | 'success' | 'error', message: string): void {
    this.emit({ type: 'toast', level, message })
  }

  async probe(url: string, headers?: Record<string, string>): Promise<ProbeResult> {
    const probe = await this.http.probe(url, headers || {})
    return {
      url,
      finalUrl: probe.finalUrl,
      fileName: probe.fileName,
      size: probe.size,
      resumable: probe.resumable,
      contentType: probe.contentType,
      headers: probe.headers
    }
  }

  async addDownload(input: AddDownloadInput): Promise<DownloadTask> {
    const rawUrl = (input.url || '').trim()
    if (!rawUrl) throw new Error('URL is empty')
    if (/^magnet:/i.test(rawUrl)) {
      return this.addTorrent({ uri: rawUrl, dir: input.dir, queueId: input.queueId })
    }
    let url: string
    try {
      url = new URL(rawUrl).toString()
    } catch {
      throw new Error('This does not look like a valid URL')
    }
    const scheme = new URL(url).protocol
    if (!['http:', 'https:', 'ftp:'].includes(scheme)) {
      throw new Error(`Unsupported protocol: ${scheme}`)
    }

    const manifest = manifestKind(url)
    const vod = input.kind === 'vod' || input.youtube?.vod === true || !!manifest
    const kind: TaskKind =
      vod || input.kind === 'youtube' || (input.kind !== 'http' && isYoutubeUrl(url))
        ? 'youtube'
        : 'http'

    const dir = input.dir?.trim() || this.store.settings.downloadDir
    await ensureDir(dir)

    const fallbackName = guessNameFromUrl(url)
    const requestedTitle = (
      input.title ||
      (input.fileName ? input.fileName.replace(/\.[^./\\]+$/, '') : '') ||
      (vod ? manifestTitle(url) : 'video')
    ).trim()
    const fileName = sanitizeFileName(
      vod
        ? `${sanitizeFileName(requestedTitle || 'video')}.${input.youtube?.audioOnly ? 'm4a' : 'mp4'}`
        : input.fileName ||
            (kind === 'youtube'
              ? `${sanitizeFileName(input.title || 'video')}.${input.youtube?.audioOnly ? 'm4a' : 'mp4'}`
              : fallbackName)
    )

    const task: DownloadTask = {
      id: randomUUID(),
      kind,
      url,
      name: input.title || (vod ? requestedTitle || fileName : fileName),
      fileName,
      dir,
      status: 'queued',
      size: 0,
      downloaded: 0,
      speed: 0,
      eta: 0,
      connections: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      headers: input.headers,
      thumbnail: input.thumbnail,
      maxConnections: input.connections,
      category: categoryFor(fileName),
      order: this.nextOrder(),
      queueId: resolveQueueId(this.queues(), input.queueId || this.store.settings.defaultQueueId)
    }
    this.autoNames.add(task.id)
    if (kind === 'youtube') {
      this.autoNames.delete(task.id)
      task.name = input.title || fileName
      task.youtube = {
        title: input.title || (vod ? requestedTitle : fileName),
        uploader: input.youtube?.uploader,
        duration: input.youtube?.duration,
        thumbnail: input.thumbnail,
        quality: input.youtube?.quality,
        formatId: input.youtube?.selector || (vod ? 'best' : 'bestvideo*+bestaudio/best'),
        audioOnly: !!input.youtube?.audioOnly,
        audioFormat: input.youtube?.audioFormat,
        subtitles: input.youtube?.subtitles,
        embedThumbnail: input.youtube?.thumbnail,
        videoId: input.youtube?.videoId,
        playlistIndex: input.youtube?.playlistIndex,
        playlistCount: input.youtube?.playlistCount,
        vod: vod || undefined,
        manifest: (manifest || input.youtube?.manifest) as 'hls' | 'dash' | undefined
      }
    }
    this.tasks.set(task.id, task)
    this.lastDownloaded.set(task.id, 0)
    this.emit({ type: 'task:add', task })
    this.emitStats(true)
    this.persistSoon()
    this.enforceQueueSchedules()
    this.schedule()
    return task
  }

  async addTorrent(input: AddTorrentInput): Promise<DownloadTask> {
    const dir = input.dir?.trim() || this.store.settings.downloadDir
    await ensureDir(dir)
    let name = input.name?.replace(/\.torrent$/i, '') || 'Torrent'
    let uri = input.uri?.trim() || ''
    if (/^magnet:/i.test(uri)) {
      const dn = /[?&]dn=([^&]+)/.exec(uri)?.[1]
      if (dn) name = decodeURIComponent(dn.replace(/\+/g, ' '))
    }
    if (!uri && !input.data) throw new Error('No torrent source provided')
    if (/^https?:/i.test(uri) && /\.torrent($|\?)/i.test(uri)) name = guessNameFromUrl(uri).replace(/\.torrent$/i, '')

    const task: DownloadTask = {
      id: randomUUID(),
      kind: 'torrent',
      url: uri || `file:${input.name || 'torrent'}`,
      name: sanitizeFileName(name),
      fileName: sanitizeFileName(name),
      dir,
      status: 'queued',
      size: 0,
      downloaded: 0,
      speed: 0,
      eta: 0,
      connections: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      category: 'other',
      order: this.nextOrder(),
      queueId: resolveQueueId(this.queues(), input.queueId || this.store.settings.defaultQueueId),
      torrent: {
        infoHash: '',
        peers: 0,
        seeds: 0,
        uploadSpeed: 0,
        uploaded: 0,
        ratio: 0,
        files: [],
        sequential: input.sequential ?? true,
        seeding: false
      }
    }
    // Stash the base64 payload / picked path on a transient field consumed by startTask.
    this.torrentPayloads.set(task.id, {
      data: input.data ? Buffer.from(input.data, 'base64') : undefined,
      file: input.fileIndices
    })
    this.tasks.set(task.id, task)
    this.lastDownloaded.set(task.id, 0)
    this.emit({ type: 'task:add', task })
    this.emitStats(true)
    this.persistSoon()
    this.enforceQueueSchedules()
    this.schedule()
    return task
  }

  private nextOrder(): number {
    const orders = [...this.tasks.values()].map((t) => t.order)
    return (orders.length ? Math.max(...orders) : 0) + 1
  }

  private persistSoon(): void {
    this.store.tasks = this.list()
  }

  private schedule(): void {
    if (this.shuttingDown) return
    const now = new Date()
    const queues = this.queues()
    const activeByQueue = new Map<string, number>()
    let activeTotal = 0
    for (const task of this.tasks.values()) {
      if (!ACTIVE.includes(task.status)) continue
      activeTotal++
      const queueId = resolveQueueId(queues, task.queueId)
      activeByQueue.set(queueId, (activeByQueue.get(queueId) || 0) + 1)
    }
    const limit = Math.max(1, this.store.settings.maxConcurrent)
    let globalSlots = limit - activeTotal
    if (globalSlots <= 0) return
    // Only queues that are open right now get a slot budget.
    const queueSlots = new Map<string, number>()
    for (const queue of queues) {
      if (!queueWindow(queue, now).open) continue
      const queueLimit =
        queue.maxConcurrent > 0 ? Math.min(limit, queue.maxConcurrent) : limit
      const remaining = queueLimit - (activeByQueue.get(queue.id) || 0)
      queueSlots.set(queue.id, Math.max(0, remaining))
    }
    const queued = [...this.tasks.values()]
      .filter((task) => task.status === 'queued')
      .sort((a, b) => a.order - b.order)
    for (const task of queued) {
      if (globalSlots <= 0) break
      if (this.controllers.has(task.id)) continue
      const queueId = resolveQueueId(queues, task.queueId)
      const slots = queueSlots.get(queueId)
      if (slots === undefined || slots <= 0) continue
      queueSlots.set(queueId, slots - 1)
      globalSlots--
      void this.startTask(task)
    }
  }

  /**
   * Wakes exactly at the next queue boundary. The one second ticker remains a
   * fallback for system sleep and clock changes.
   */
  private armQueueTimer(): void {
    if (this.queueTimer) {
      clearTimeout(this.queueTimer)
      this.queueTimer = null
    }
    this.queueArmedAt = Date.now()
    if (this.shuttingDown) return
    const now = new Date()
    let next: number | null = null
    for (const queue of this.queues()) {
      const change = queueWindow(queue, now).nextChange
      if (!change) continue
      const time = change.getTime()
      if (time <= now.getTime()) continue
      if (next === null || time < next) next = time
    }
    if (next === null) return
    const delay = Math.max(100, Math.min(next - Date.now() + 100, 2 ** 31 - 1))
    this.queueTimer = setTimeout(() => {
      this.queueTimer = null
      if (this.shuttingDown) return
      if (this.enforceQueueSchedules()) this.schedule()
      this.armQueueTimer()
    }, delay)
    this.queueTimer.unref?.()
  }

  private stopForQueue(task: DownloadTask): void {
    if (!ACTIVE.includes(task.status) && task.status !== 'queued') return
    this.queueHold.add(task.id)
    this.resumeFlags.add(task.id)
    task.heldByQueue = true
    this.controllers.get(task.id)?.abort()
    if (task.kind === 'torrent') this.torrent.pause(task.id)
    if (task.kind === 'youtube') this.youtube.stop(task.id)
    if (task.status === 'queued') {
      this.patch(task, { status: 'paused', speed: 0, eta: 0, connections: 0, heldByQueue: true })
    }
    this.persistSoon()
  }

  /**
   * Stops downloads whose queue schedule closed and requeues downloads that
   * were paused by a schedule once their queue opens again.
   */
  private enforceQueueSchedules(): boolean {
    const now = new Date()
    const queues = this.queues()
    const states = new Map<string, boolean>()
    let changed = false
    for (const queue of queues) {
      const open = queueWindow(queue, now).open
      states.set(queue.id, open)
      if (this.queueOpenState.get(queue.id) !== open) changed = true
    }
    this.queueOpenState = states
    for (const task of this.tasks.values()) {
      if (!ACTIVE.includes(task.status) && task.status !== 'queued') continue
      if (this.queueHold.has(task.id)) continue
      const queueId = resolveQueueId(queues, task.queueId)
      if (states.get(queueId) === false) {
        this.stopForQueue(task)
        changed = true
      }
    }
    for (const task of [...this.tasks.values()]) {
      if (!this.queueHold.has(task.id)) continue
      const queueId = resolveQueueId(queues, task.queueId)
      if (states.get(queueId) !== true) continue
      if (task.status === 'paused') {
        this.queueHold.delete(task.id)
        this.patch(task, {
          status: 'queued',
          error: undefined,
          speed: 0,
          eta: 0,
          connections: 0,
          heldByQueue: false
        })
        changed = true
      } else if (!ACTIVE.includes(task.status) && task.status !== 'queued') {
        this.queueHold.delete(task.id)
        task.heldByQueue = false
      }
    }
    return changed
  }

  private async startTask(task: DownloadTask): Promise<void> {
    if (this.controllers.has(task.id) || this.shuttingDown) return
    const controller = new AbortController()
    this.controllers.set(task.id, controller)
    const handle: TaskHandle = {
      task,
      signal: controller.signal,
      patch: (patch) => this.patch(task, patch),
      toast: (level, message) => this.toast(level, message)
    }
    this.patch(task, { status: 'connecting', error: undefined, speed: 0, eta: 0 })
    this.emitStats(true)
    try {
      if (task.kind === 'http') {
        const resume = this.resumeFlags.has(task.id) || task.downloaded > 0
        await this.http.start(handle, resume)
      } else if (task.kind === 'youtube') {
        const yt = task.youtube
        await this.youtube.start(handle, {
          audioOnly: !!yt?.audioOnly,
          extractAudio: yt?.audioFormat === 'mp3',
          subtitles: !!yt?.subtitles,
          thumbnail: !!yt?.embedThumbnail
        })
      } else {
        const payload = this.torrentPayloads.get(task.id)
        this.torrentPayloads.delete(task.id)
        await this.torrent.startOrResume(handle, {
          uri: task.url,
          data: payload?.data,
          torrentFile: task.torrent?.torrentFile,
          sequential: task.torrent?.sequential ?? true,
          fileIndices: payload?.file
        })
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        this.patch(task, {
          status: 'error',
          error: (err as Error).message || 'Download failed',
          speed: 0,
          eta: 0,
          connections: 0
        })
      }
    } finally {
      this.controllers.delete(task.id)
      this.resumeFlags.delete(task.id)
      if (task.status === 'downloading' || task.status === 'connecting') {
        if (task.kind !== 'torrent' || this.torrent.status() !== 'ready') {
          // Engine returned without an explicit terminal state.
          if (!controller.signal.aborted) this.patch(task, { status: 'paused' })
        }
      }
      this.lastDownloaded.set(task.id, task.downloaded)
      this.schedule()
      this.emitStats(true)
    }
  }

  pause(id: string): void {
    const task = this.tasks.get(id)
    if (!task) return
    if (!ACTIVE.includes(task.status) && task.status !== 'queued') return
    this.queueHold.delete(id)
    task.heldByQueue = false
    this.resumeFlags.add(id)
    this.controllers.get(id)?.abort()
    if (task.kind === 'torrent') this.torrent.pause(id)
    if (task.kind === 'youtube') this.youtube.stop(id)
    if (task.status === 'queued') {
      this.patch(task, { status: 'paused', speed: 0, eta: 0, connections: 0, heldByQueue: false })
    }
    this.persistSoon()
  }

  pauseAll(): number {
    let count = 0
    for (const task of this.tasks.values()) {
      if (ACTIVE.includes(task.status) || task.status === 'queued') {
        this.pause(task.id)
        count++
      }
    }
    return count
  }

  pauseTasks(ids: string[]): number {
    let count = 0
    for (const id of ids) {
      const task = this.tasks.get(id)
      if (!task) continue
      if (!ACTIVE.includes(task.status) && task.status !== 'queued') continue
      this.pause(id)
      count++
    }
    return count
  }

  async resume(id: string): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) return
    if (!RESUMABLE.includes(task.status)) return
    this.queueHold.delete(id)
    this.resumeFlags.add(id)
    this.patch(task, {
      status: 'queued',
      error: undefined,
      speed: 0,
      eta: 0,
      connections: 0,
      heldByQueue: false
    })
    this.enforceQueueSchedules()
    this.schedule()
  }

  resumeTasks(ids: string[]): number {
    let count = 0
    for (const id of ids) {
      const task = this.tasks.get(id)
      if (!task || !RESUMABLE.includes(task.status)) continue
      this.queueHold.delete(id)
      this.resumeFlags.add(id)
      this.patch(task, {
        status: 'queued',
        error: undefined,
        speed: 0,
        eta: 0,
        connections: 0,
        heldByQueue: false
      })
      count++
    }
    if (count > 0) {
      this.enforceQueueSchedules()
      this.schedule()
    }
    return count
  }

  /**
   * Continue an interrupted HTTP download with a freshly issued URL. Only the
   * source changes: the destination, partial file and byte offsets are kept, so
   * links that expire mid-download can be replaced without losing progress.
   */
  async resumeWithUrl(id: string, rawUrl: string): Promise<ResumeWithUrlResult> {
    const task = this.tasks.get(id)
    if (!task) return { ok: false, error: 'Download not found.' }
    if (task.kind !== 'http') {
      return { ok: false, error: 'Only direct HTTP downloads can use a new link.' }
    }
    if (task.status === 'completed') {
      return { ok: false, error: 'This download is already complete.' }
    }
    const trimmed = (rawUrl || '').trim()
    let url: string
    try {
      url = new URL(trimmed).toString()
    } catch {
      return { ok: false, error: 'Enter a valid HTTP or HTTPS link.' }
    }
    if (!/^https?:$/.test(new URL(url).protocol)) {
      return { ok: false, error: 'Enter a valid HTTP or HTTPS link.' }
    }
    if (ACTIVE.includes(task.status)) {
      this.controllers.get(id)?.abort()
      // Let the running engine unwind and persist its final sidecar state
      // before the metadata is rewritten for the new link.
      for (let i = 0; i < 50 && this.controllers.has(id); i++) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      if (this.controllers.has(id)) {
        return { ok: false, error: 'Could not stop the current download. Pause it first.' }
      }
    }
    const prepared = await this.http.resumeWithUrl(task, url)
    if (!prepared.ok) return { ok: false, error: prepared.error }
    const restarted = !!prepared.restarted
    this.patch(task, {
      url,
      status: 'queued',
      error: undefined,
      linkExpired: false,
      speed: 0,
      eta: 0,
      connections: 0,
      downloaded: restarted ? 0 : task.downloaded,
      segments: restarted ? undefined : task.segments,
      size: restarted ? prepared.size || 0 : task.size || prepared.size || 0,
      resumable: restarted ? undefined : task.resumable,
      heldByQueue: false
    })
    this.resumeFlags.add(id)
    this.enforceQueueSchedules()
    this.schedule()
    return { ok: true, restarted }
  }

  async cancel(id: string): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) return
    this.controllers.get(id)?.abort()
    if (task.kind === 'torrent') {
      this.torrent.pause(id)
      await this.torrent.remove(id)
    }
    if (task.kind === 'youtube') this.youtube.stop(id)
    this.patch(task, {
      status: 'paused',
      speed: 0,
      eta: 0,
      connections: 0
    })
  }

  async remove(id: string, deleteFile: boolean): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) return
    this.controllers.get(id)?.abort()
    this.controllers.delete(id)
    if (task.kind === 'torrent') await this.torrent.remove(id)
    if (task.kind === 'youtube') this.youtube.stop(id)
    this.tasks.delete(id)
    this.lastDownloaded.delete(id)
    this.autoNames.delete(id)
    this.resumeFlags.delete(id)
    this.queueHold.delete(id)
    if (deleteFile) await this.deleteFiles(task)
    this.emit({ type: 'task:remove', id })
    this.persistSoon()
    this.emitStats(true)
    this.schedule()
  }

  /** Removes several downloads at once and reports how many were removed. */
  async removeTasks(ids: string[], deleteFile: boolean): Promise<number> {
    let removed = 0
    for (const id of new Set(ids)) {
      if (!this.tasks.has(id)) continue
      await this.remove(id, deleteFile)
      removed++
    }
    return removed
  }

  /** Moves downloads to another queue, keeping their running state intact. */
  setTasksQueue(ids: string[], queueId: string): number {
    const queues = this.queues()
    const resolved = resolveQueueId(queues, queueId)
    let count = 0
    for (const id of new Set(ids)) {
      const task = this.tasks.get(id)
      if (!task || task.queueId === resolved) continue
      const wasHeld = this.queueHold.delete(id)
      this.patch(task, {
        queueId: resolved,
        ...(wasHeld
          ? {
              status: 'queued' as TaskStatus,
              error: undefined,
              speed: 0,
              eta: 0,
              connections: 0,
              heldByQueue: false
            }
          : {})
      })
      count++
    }
    if (count > 0) {
      this.enforceQueueSchedules()
      this.schedule()
      this.armQueueTimer()
    }
    return count
  }

  private safeInside(dir: string, target: string): boolean {
    const rel = relative(dir, target)
    return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
  }

  private async deleteFiles(task: DownloadTask): Promise<void> {
    const targets = new Set<string>()
    if (task.filePath) targets.add(task.filePath)
    if (task.kind === 'http') {
      if (task.filePath) {
        targets.add(`${task.filePath}.pulse-part`)
        targets.add(`${task.filePath}.pulse-meta`)
      }
      if (!task.filePath) {
        const guess = join(task.dir, task.fileName)
        targets.add(guess)
        targets.add(`${guess}.pulse-part`)
        targets.add(`${guess}.pulse-meta`)
      }
    }
    for (const target of targets) {
      if (!this.safeInside(task.dir, target)) continue
      try {
        await fs.rm(target, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }

  async retry(id: string): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) return
    this.resumeFlags.add(id)
    this.patch(task, {
      status: 'queued',
      error: undefined,
      speed: 0,
      eta: 0,
      connections: 0,
      heldByQueue: false
    })
    this.enforceQueueSchedules()
    this.schedule()
  }

  reveal(id: string): void {
    const task = this.tasks.get(id)
    if (!task) return
    const target = task.filePath && existsSync(task.filePath) ? task.filePath : task.dir
    if (existsSync(target)) shell.showItemInFolder(target)
    else void shell.openPath(task.dir)
  }

  async open(id: string): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) return
    const target = task.filePath || join(task.dir, task.fileName)
    if (existsSync(target)) {
      const err = await shell.openPath(target)
      if (err) this.toast('error', `Could not open the file: ${err}`)
    } else {
      this.toast('info', 'The file is not on disk yet.')
    }
  }

  clearCompleted(): void {
    for (const task of [...this.tasks.values()]) {
      if (task.status === 'completed') {
        this.tasks.delete(task.id)
        this.lastDownloaded.delete(task.id)
        this.emit({ type: 'task:remove', id: task.id })
      }
    }
    this.persistSoon()
    this.emitStats(true)
  }

  updateSettings(patch: Partial<Settings>): Settings {
    const prev = this.store.settings
    let nextPatch = patch
    if (patch.proxy !== undefined) {
      const parsed = parseProxy(patch.proxy)
      if (!parsed.ok) throw new Error('The proxy address is not valid.')
      nextPatch = { ...patch, proxy: parsed.proxy?.url ?? '' }
    }
    const settings = this.store.patchSettings(nextPatch)
    if (nextPatch.proxy !== undefined) {
      configureProxy(settings.proxy)
    }
    if (patch.globalSpeedLimit !== undefined) {
      this.throttle.setLimit(settings.globalSpeedLimit)
      this.torrent.setLimit(settings.globalSpeedLimit)
    }
    if (patch.maxConcurrent !== undefined) this.schedule()
    if (patch.queues !== undefined || patch.defaultQueueId !== undefined) {
      const queues = normalizeQueues(settings.queues)
      settings.queues = queues
      settings.defaultQueueId = resolveQueueId(queues, settings.defaultQueueId)
      for (const task of this.tasks.values()) {
        const next = resolveQueueId(queues, task.queueId)
        if (task.queueId === next) continue
        this.patch(task, { queueId: next })
      }
      this.persistSoon()
      this.queueOpenState.clear()
      this.enforceQueueSchedules()
      this.schedule()
      this.armQueueTimer()
    }
    if (patch.downloadDir && patch.downloadDir !== prev.downloadDir) {
      void ensureDir(settings.downloadDir)
    }
    if (patch.ytDlpPath !== undefined || patch.ffmpegPath !== undefined) {
      void this.refreshTools()
    }
    if (patch.launchAtStartup !== undefined || patch.startMinimized !== undefined) {
      void applyLaunchAtStartup(settings.launchAtStartup, settings.startMinimized)
    }
    if (patch.theme !== undefined) {
      nativeTheme.themeSource = settings.theme
    }
    this.emit({ type: 'settings', settings })
    this.emitStats(true)
    return settings
  }

  setSpeedLimit(bytes: number): void {
    this.updateSettings({ globalSpeedLimit: Math.max(0, bytes) })
  }

  private tick(): void {
    const now = Date.now()
    if (this.enforceQueueSchedules()) {
      this.schedule()
      this.armQueueTimer()
    } else if (now - this.queueArmedAt > 60_000) {
      // Re-arm periodically so DST and manual clock changes do not drift.
      this.armQueueTimer()
    }
    for (const task of this.tasks.values()) {
      const last = this.lastDownloaded.get(task.id) ?? task.downloaded
      const isActive = task.status === 'downloading'
      if (isActive) {
        const delta = Math.max(0, task.downloaded - last)
        // Exponential smoothing keeps the readout from jumping around.
        task.speed = task.speed ? Math.round(task.speed * 0.55 + delta * 0.45) : delta
        if (task.size > 0) {
          task.eta = task.speed > 8 ? Math.round((task.size - task.downloaded) / task.speed) : 0
        } else {
          task.eta = 0
        }
        this.emit({ type: 'task:update', task })
      } else if (task.speed !== 0) {
        task.speed = 0
        task.eta = 0
      }
      this.lastDownloaded.set(task.id, task.downloaded)
    }
    this.emitStats(false, now)
  }

  stats(): GlobalStats {
    const tasks = [...this.tasks.values()]
    const down = tasks.reduce((acc, t) => acc + (t.status === 'downloading' ? t.speed : 0), 0)
    const up = tasks.reduce(
      (acc, t) => acc + (t.kind === 'torrent' ? t.torrent?.uploadSpeed || 0 : 0),
      0
    )
    return {
      downSpeed: down,
      upSpeed: up,
      activeCount: tasks.filter((t) => ACTIVE.includes(t.status)).length,
      queuedCount: tasks.filter((t) => t.status === 'queued').length,
      completedCount: tasks.filter((t) => t.status === 'completed').length,
      totalDownloaded: tasks.reduce((acc, t) => acc + t.downloaded, 0),
      history: this.history,
      torrentEngine: this.torrent.status(),
      ytdlp: this.toolStatus.ytdlp,
      ffmpeg: this.toolStatus.ffmpeg
    }
  }

  private emitStats(force = false, now = Date.now()): void {
    if (!force && now - this.lastStatsEmit < 900) return
    this.lastStatsEmit = now
    const stats = this.stats()
    this.history.push({ t: now, down: stats.downSpeed, up: stats.upSpeed })
    if (this.history.length > 90) this.history.shift()
    this.emit({ type: 'stats', stats })
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true
    this.queueHold.clear()
    if (this.queueTimer) clearTimeout(this.queueTimer)
    this.queueTimer = null
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
    // Remember transfers that were running so autoResume can continue them
    // after the next launch instead of leaving them paused.
    for (const task of this.tasks.values()) {
      if (ACTIVE.includes(task.status)) task.resumeOnStart = true
    }
    for (const controller of this.controllers.values()) controller.abort()
    for (const task of this.tasks.values()) {
      if (ACTIVE.includes(task.status)) task.status = 'paused'
      task.speed = 0
      task.eta = 0
      task.connections = 0
    }
    this.persistSoon()
    await this.torrent.destroy()
    await disposeProxy()
    await this.store.flush()
  }

  async readClipboardUrl(): Promise<string> {
    const text = (await clipboard.readText()).trim()
    if (/^(https?:\/\/|magnet:)/i.test(text) && text.length < 4096) return text
    return ''
  }

  revealDir(dir: string): void {
    if (existsSync(dir)) void shell.openPath(dir)
  }

  async installYtdlp(): Promise<{ ok: boolean; message: string }> {
    const result = await this.youtube.install()
    if (result.ok) {
      this.toast('success', result.message)
      await this.refreshTools()
    } else {
      this.toast('error', result.message)
    }
    return result
  }

  async rescanTools(): Promise<void> {
    try {
      this.toolStatus = await this.youtube.rescan()
    } catch {
      this.toolStatus = {
        ytdlp: { available: false },
        ffmpeg: { available: false }
      }
    }
    this.emitStats(true)
  }

  taskTitle(task: DownloadTask): string {
    return task.youtube?.title || task.name || basename(task.fileName || 'download')
  }
}
