import { promises as fs, existsSync } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import type { DownloadTask, Settings, SegmentState } from '@shared/types'
import { currentProxy, fetchFromAdapter, proxiedFetch } from '../proxy'
import { selectedNetworkAdapters } from '../network'
import {
  GlobalThrottle,
  ensureDir,
  extFromMime,
  fileSize,
  guessNameFromUrl,
  moveSafe,
  parseContentDisposition,
  safeJsonParse,
  sanitizeFileName,
  sleep,
  uniquePath
} from '../util'

export interface EngineHost {
  settings(): Settings
  patch(task: DownloadTask, patch: Partial<DownloadTask>): void
  toast(level: 'info' | 'success' | 'error', message: string): void
  throttle: GlobalThrottle
}

export interface TaskHandle {
  task: DownloadTask
  signal: AbortSignal
  patch: (patch: Partial<DownloadTask>) => void
  toast: (level: 'info' | 'success' | 'error', message: string) => void
}

export interface ProbeOutput {
  url: string
  finalUrl: string
  fileName: string
  size: number
  resumable: boolean
  contentType?: string
  etag?: string
  lastModified?: string
  headers: Record<string, string>
}

interface HttpMeta {
  version: 1
  finalUrl: string
  size: number
  etag?: string
  lastModified?: string
  resumable: boolean
  segments: SegmentState[]
  downloaded: number
  savedAt: number
}

const META_SUFFIX = '.pulse-meta'
const PART_SUFFIX = '.pulse-part'
const MAX_RETRIES = 5
const EXPIRED_STATUSES = [401, 403, 404, 410]
const LINK_EXPIRED_PREFIX = 'LINK_EXPIRED:'

function parseTotalFromHeaders(res: Response): number {
  const cr = res.headers.get('content-range')
  if (cr) {
    const total = cr.split('/')[1]
    if (total && total !== '*') {
      const n = Number(total)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  const len = Number(res.headers.get('content-length') || 0)
  return Number.isFinite(len) && len > 0 ? len : 0
}

export class HttpEngine {
  private host: EngineHost

  constructor(host: EngineHost) {
    this.host = host
  }

  private baseHeaders(task: DownloadTask): Record<string, string> {
    const settings = this.host.settings()
    const headers: Record<string, string> = {
      'User-Agent': settings.userAgent,
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'identity'
    }
    try {
      const origin = new URL(task.url).origin
      if (origin && origin !== 'null') headers.Referer = `${origin}/`
    } catch {
      /* ignore */
    }
    return { ...headers, ...(task.headers || {}) }
  }

  async probe(
    url: string,
    headers: Record<string, string> = {},
    userAgent?: string
  ): Promise<ProbeOutput> {
    const settings = this.host.settings()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await proxiedFetch(url, {
        headers: {
          'User-Agent': userAgent || settings.userAgent,
          Accept: '*/*',
          'Accept-Encoding': 'identity',
          Range: 'bytes=0-0',
          ...headers
        },
        signal: controller.signal,
        redirect: 'follow'
      })
      if (!res.ok && res.status !== 416) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`)
      }
      const size = parseTotalFromHeaders(res)
      const resumable = res.status === 206 || /bytes/i.test(res.headers.get('accept-ranges') || '')
      const contentType = res.headers.get('content-type') || undefined
      let fileName =
        parseContentDisposition(res.headers.get('content-disposition')) ||
        guessNameFromUrl(res.url || url)
      if (!/\.[a-z0-9]{2,6}$/i.test(fileName)) {
        const ext = extFromMime(contentType)
        if (ext) fileName += ext
      }
      fileName = sanitizeFileName(fileName)
      const outHeaders: Record<string, string> = {}
      res.headers.forEach((value, key) => {
        if (['content-length', 'content-type', 'content-disposition'].includes(key)) {
          outHeaders[key] = value
        }
      })
      try {
        await res.body?.cancel()
      } catch {
        /* ignore */
      }
      return {
        url,
        finalUrl: res.url || url,
        fileName,
        size,
        resumable,
        contentType,
        etag: res.headers.get('etag') || undefined,
        lastModified: res.headers.get('last-modified') || undefined,
        headers: outHeaders
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * Point an existing partial download at a fresh URL. The sidecar metadata is
   * rewritten so the next resume continues from the saved byte offsets. When
   * the new link serves a different file size the partial data is discarded and
   * `restarted` is returned so the UI can tell the user.
   */
  async resumeWithUrl(
    task: DownloadTask,
    url: string
  ): Promise<{ ok: boolean; restarted?: boolean; error?: string; size?: number }> {
    let probe: ProbeOutput
    try {
      const probeHeaders = this.baseHeaders({ ...task, url })
      probe = await this.probe(url, probeHeaders, this.host.settings().userAgent)
    } catch (err) {
      return { ok: false, error: `Could not reach the new link: ${(err as Error).message}` }
    }

    let restarted = false
    let kept = false
    const finalPath = task.filePath
    if (finalPath) {
      const metaPath = `${finalPath}${META_SUFFIX}`
      const partPath = `${finalPath}${PART_SUFFIX}`
      if (existsSync(metaPath) && existsSync(partPath)) {
        const raw = await fs.readFile(metaPath, 'utf8').catch(() => '')
        const meta = safeJsonParse<HttpMeta | null>(raw, null)
        if (meta && meta.version === 1) {
          const sizeChanged = meta.size > 0 && probe.size > 0 && meta.size !== probe.size
          // A signed link that no longer honours Range requests cannot be
          // resumed, so keeping the partial data would only stall the task.
          const rangesLost = task.downloaded > 0 && probe.size > 0 && !probe.resumable
          if (sizeChanged || rangesLost) {
            await fs.unlink(partPath).catch(() => undefined)
            await fs.unlink(metaPath).catch(() => undefined)
            restarted = task.downloaded > 0
          } else {
            meta.finalUrl = probe.finalUrl
            meta.etag = probe.etag
            meta.lastModified = probe.lastModified
            meta.resumable = probe.resumable
            if (!probe.resumable && task.downloaded === 0) {
              meta.segments = []
              meta.downloaded = 0
            }
            meta.savedAt = Date.now()
            await fs.writeFile(metaPath, JSON.stringify(meta), 'utf8').catch(() => undefined)
            kept = true
          }
        }
      }
    }
    if (!kept && !restarted) restarted = task.downloaded > 0
    return { ok: true, restarted, size: probe.size }
  }

  async start(handle: TaskHandle, resume: boolean): Promise<void> {
    const task = handle.task
    const settings = this.host.settings()
    await ensureDir(task.dir)

    if (!task.fileName) task.fileName = guessNameFromUrl(task.url)
    let fileName = sanitizeFileName(task.fileName)

    let finalPath = task.filePath || join(task.dir, fileName)
    let metaPath = `${finalPath}${META_SUFFIX}`
    let partPath = `${finalPath}${PART_SUFFIX}`

    // Keep the sidecar paths in sync whenever the final name is adjusted.
    const setFinalPath = (next: string): void => {
      finalPath = next
      metaPath = `${next}${META_SUFFIX}`
      partPath = `${next}${PART_SUFFIX}`
    }

    if (resume && existsSync(finalPath) && !existsSync(partPath)) {
      // Nothing left to do. The file is already complete on disk.
      const size = await fileSize(finalPath)
      handle.patch({
        status: 'completed',
        downloaded: size,
        size: size || task.size,
        connections: 0,
        speed: 0,
        eta: 0,
        completedAt: Date.now(),
        filePath: finalPath,
        fileName
      })
      return
    }

    let meta: HttpMeta | null = null
    if (resume && existsSync(metaPath) && existsSync(partPath)) {
      const raw = await fs.readFile(metaPath, 'utf8').catch(() => '')
      const parsed = safeJsonParse<HttpMeta | null>(raw, null)
      if (parsed && parsed.version === 1 && parsed.size > 0 && parsed.segments?.length) {
        meta = parsed
      }
    }

    if (!meta) {
      if (!task.filePath) {
        const target = await uniquePath(task.dir, fileName)
        setFinalPath(target)
        fileName = target.split(/[\\/]/).pop() as string
      }
      handle.patch({ status: 'connecting', filePath: finalPath, fileName, error: undefined })
      let probe: ProbeOutput
      try {
        probe = await this.probe(task.url, task.headers, settings.userAgent)
      } catch (err) {
        const message = (err as Error).message
        handle.patch({
          status: 'error',
          error: `Could not reach the server: ${message}`,
          linkExpired: /^HTTP (401|403|404|410)\b/.test(message) || task.linkExpired,
          connections: 0,
          speed: 0,
          eta: 0
        })
        return
      }
      if (handle.signal.aborted) return
      if (!task.fileName || task.fileName === guessNameFromUrl(task.url)) {
        const nice = sanitizeFileName(probe.fileName)
        if (nice && nice !== fileName) {
          const target = await uniquePath(task.dir, nice)
          setFinalPath(target)
          fileName = target.split(/[\\/]/).pop() as string
        }
      }
      meta = {
        version: 1,
        finalUrl: probe.finalUrl,
        size: probe.size,
        etag: probe.etag,
        lastModified: probe.lastModified,
        resumable: probe.resumable,
        segments: [],
        downloaded: 0,
        savedAt: Date.now()
      }
      handle.patch({
        size: probe.size,
        resumable: probe.resumable,
        filePath: finalPath,
        fileName
      })
    }

    if (meta.size <= 0) {
      await this.streamUnknownSize(handle, finalPath, meta.finalUrl)
      return
    }

    const adapters = this.networkAddresses(settings, meta.resumable)
    const requestedConnections = meta.resumable
      ? Math.max(1, task.maxConnections || settings.connections)
      : 1
    // Multi-network needs at least one stream on each adapter, even when the
    // user asked for a single connection.
    const connectionCount = meta.resumable
      ? Math.min(32, Math.max(requestedConnections, adapters.length))
      : 1
    const segments: SegmentState[] = meta.segments.length
      ? meta.segments
      : this.buildSegments(meta.size, connectionCount)

    const partExists = existsSync(partPath)
    let handleFs: FileHandle
    try {
      handleFs = partExists ? await fs.open(partPath, 'r+') : await fs.open(partPath, 'w+')
      if (!partExists && meta.size > 0) await handleFs.truncate(meta.size)
      const stat = await handleFs.stat()
      if (meta.size > 0 && stat.size < meta.size) await handleFs.truncate(meta.size)
    } catch (err) {
      handle.patch({
        status: 'error',
        error: `Cannot write file: ${(err as Error).message}`,
        connections: 0,
        speed: 0,
        eta: 0
      })
      return
    }

    const state: HttpMeta = {
      ...meta,
      segments,
      downloaded: segments.reduce((acc, s) => acc + Math.max(0, s.position - s.start), 0),
      savedAt: Date.now()
    }

    let lastEmit = 0
    let lastSave = 0

    const activeConns = segments.filter((s) => s.position < s.end).length || 1
    handle.patch({
      status: 'downloading',
      filePath: finalPath,
      fileName,
      size: state.size,
      downloaded: state.downloaded,
      connections: activeConns,
      resumable: state.resumable,
      networkCount: adapters.length > 1 ? adapters.length : undefined,
      segments: state.segments.map((s) => ({ ...s })),
      error: undefined,
      linkExpired: false
    })

    const recompute = (): void => {
      state.downloaded = state.segments.reduce(
        (acc, s) => acc + Math.max(0, s.position - s.start),
        0
      )
    }

    const persist = async (): Promise<void> => {
      recompute()
      state.savedAt = Date.now()
      await fs.writeFile(metaPath, JSON.stringify(state), 'utf8').catch(() => undefined)
    }

    const tick = (): void => {
      const now = Date.now()
      if (now - lastEmit >= 160) {
        lastEmit = now
        recompute()
        handle.patch({
          downloaded: state.downloaded,
          size: state.size,
          segments: state.segments.map((s) => ({ ...s }))
        })
      }
      if (now - lastSave > 2500) {
        lastSave = now
        void persist()
      }
    }

    const downloadSegment = async (seg: SegmentState, index: number): Promise<void> => {
      let attempt = 0
      while (seg.position < seg.end) {
        if (handle.signal.aborted) return
        const controller = new AbortController()
        const relay = (): void => controller.abort()
        handle.signal.addEventListener('abort', relay, { once: true })
        try {
          const ranged = state.resumable || seg.position > 0 || state.segments.length > 1
          const headers = { ...this.baseHeaders(task) }
          if (ranged) headers.Range = `bytes=${seg.position}-${seg.end - 1}`

          const init: RequestInit = {
            headers,
            signal: controller.signal,
            redirect: 'follow'
          }
          // Retries rotate through the adapters, so one unreachable interface
          // cannot stall a segment forever.
          const adapter = adapters.length
            ? adapters[(index + attempt) % adapters.length]
            : ''
          const res = adapter
            ? await fetchFromAdapter(state.finalUrl, init, adapter)
            : await proxiedFetch(state.finalUrl, init)
          if (res.status === 416) throw new Error('RANGE_CHANGED')
          if (!res.ok) {
            if (EXPIRED_STATUSES.includes(res.status)) {
              throw new Error(`${LINK_EXPIRED_PREFIX}${res.status}`)
            }
            throw new Error(`HTTP ${res.status} ${res.statusText}`)
          }
          if (res.status === 200 && seg.position > 0) throw new Error('RANGE_UNSUPPORTED')
          if (!res.body) throw new Error('Empty response body')

          const reader = res.body.getReader()
          while (true) {
            if (handle.signal.aborted) {
              await reader.cancel().catch(() => undefined)
              return
            }
            const { done, value } = await reader.read()
            if (done) break
            if (!value || !value.byteLength) continue
            const remain = seg.end - seg.position
            if (remain <= 0) break
            const len = Math.min(value.byteLength, remain)
            const buf = Buffer.from(value.buffer, value.byteOffset, len)
            await handleFs.write(buf, 0, len, seg.position)
            seg.position += len
            await this.host.throttle.consume(len, handle.signal)
            tick()
            if (len < value.byteLength) break
          }
          attempt = 0
        } catch (err) {
          if (handle.signal.aborted) return
          const message = (err as Error).message || 'network error'
          if (
            message === 'RANGE_CHANGED' ||
            message === 'RANGE_UNSUPPORTED' ||
            message.startsWith(LINK_EXPIRED_PREFIX)
          ) {
            throw err
          }
          attempt++
          if (attempt > MAX_RETRIES) {
            throw new Error(`Connection ${index + 1} failed: ${message}`)
          }
          await sleep(Math.min(5000, 350 * Math.pow(2, attempt)), handle.signal)
        } finally {
          handle.signal.removeEventListener('abort', relay)
        }
      }
    }

    try {
      await Promise.all(segments.map((seg, i) => downloadSegment(seg, i)))
      if (handle.signal.aborted) throw new DOMException('Aborted', 'AbortError')
      await handleFs.close().catch(() => undefined)
      await persist()

      const finalSize = await fileSize(partPath)
      if (state.size > 0 && finalSize !== state.size) {
        throw new Error(`Incomplete file (${finalSize} of ${state.size} bytes)`)
      }
      await moveSafe(partPath, finalPath)
      await fs.unlink(metaPath).catch(() => undefined)
      handle.patch({
        status: 'completed',
        downloaded: state.size || finalSize,
        size: state.size || finalSize,
        completedAt: Date.now(),
        filePath: finalPath,
        fileName: finalPath.split(/[\\/]/).pop() as string,
        connections: 0,
        speed: 0,
        eta: 0
      })
    } catch (err) {
      await handleFs.close().catch(() => undefined)
      await persist()
      if (handle.signal.aborted || (err as Error).name === 'AbortError') {
        handle.patch({ status: 'paused', speed: 0, eta: 0, connections: 0 })
        return
      }
      const message = (err as Error).message || 'Download failed'
      if (message.startsWith(LINK_EXPIRED_PREFIX)) {
        const status = message.slice(LINK_EXPIRED_PREFIX.length)
        handle.patch({
          status: 'error',
          error: `HTTP ${status}: the download link may have expired.`,
          linkExpired: true,
          speed: 0,
          eta: 0,
          connections: 0
        })
        return
      }
      if (message === 'RANGE_UNSUPPORTED' || message === 'RANGE_CHANGED') {
        await fs.unlink(partPath).catch(() => undefined)
        await fs.unlink(metaPath).catch(() => undefined)
        if (message === 'RANGE_CHANGED') {
          handle.toast('info', 'The file changed on the server. Restarting the download.')
        }
        await this.start({ ...handle, task: { ...task, filePath: undefined } }, false)
        return
      }
      handle.patch({
        status: 'error',
        error: message,
        speed: 0,
        eta: 0,
        connections: 0
      })
    }
  }

  /** Fallback for servers that do not report a content length. */
  private async streamUnknownSize(
    handle: TaskHandle,
    finalPath: string,
    finalUrl: string
  ): Promise<void> {
    const task = handle.task
    const partPath = `${finalPath}${PART_SUFFIX}`
    const metaPath = `${finalPath}${META_SUFFIX}`
    const controller = new AbortController()
    const relay = (): void => controller.abort()
    handle.signal.addEventListener('abort', relay, { once: true })
    let fsHandle: FileHandle | null = null
    let downloaded = 0
    const started = Date.now()
    try {
      const res = await proxiedFetch(finalUrl, {
        headers: this.baseHeaders(task),
        signal: controller.signal,
        redirect: 'follow'
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      if (!res.body) throw new Error('Empty response body')
      fsHandle = await fs.open(partPath, 'w+')
      handle.patch({
        status: 'downloading',
        connections: 1,
        filePath: finalPath,
        linkExpired: false
      })
      const reader = res.body.getReader()
      let lastEmit = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value?.byteLength) continue
        const buf = Buffer.from(value.buffer, value.byteOffset, value.byteLength)
        await fsHandle.write(buf, 0, buf.length, downloaded)
        downloaded += buf.length
        await this.host.throttle.consume(buf.length, handle.signal)
        const now = Date.now()
        if (now - lastEmit > 160) {
          lastEmit = now
          handle.patch({ downloaded, size: 0 })
        }
      }
      await fsHandle.close()
      fsHandle = null
      await moveSafe(partPath, finalPath)
      await fs.unlink(metaPath).catch(() => undefined)
      handle.patch({
        status: 'completed',
        downloaded,
        size: downloaded,
        completedAt: Date.now(),
        connections: 0,
        speed: 0,
        eta: 0,
        filePath: finalPath,
        fileName: finalPath.split(/[\\/]/).pop() as string,
        resumable: false
      })
      void started
    } catch (err) {
      await fsHandle?.close().catch(() => undefined)
      if (handle.signal.aborted || (err as Error).name === 'AbortError') {
        handle.patch({ status: 'paused', downloaded, speed: 0, eta: 0, connections: 0 })
        return
      }
      const message = (err as Error).message || 'Download failed'
      handle.patch({
        status: 'error',
        error: message,
        linkExpired: /^HTTP (401|403|404|410)\b/.test(message) || task.linkExpired,
        downloaded,
        speed: 0,
        eta: 0,
        connections: 0
      })
    } finally {
      handle.signal.removeEventListener('abort', relay)
    }
  }

  private networkAddresses(settings: Settings, resumable: boolean): string[] {
    if (!resumable || currentProxy()) return []
    return selectedNetworkAdapters(settings)
  }

  private buildSegments(size: number, connections: number): SegmentState[] {
    if (size <= 0) {
      return [{ start: 0, end: Number.MAX_SAFE_INTEGER, position: 0 }]
    }
    const maxUseful = Math.ceil(size / (1024 * 1024))
    const count = Math.max(1, Math.min(connections, maxUseful))
    const chunk = Math.floor(size / count)
    const segments: SegmentState[] = []
    for (let i = 0; i < count; i++) {
      const start = i * chunk
      const end = i === count - 1 ? size : start + chunk
      segments.push({ start, end, position: start })
    }
    return segments
  }
}
