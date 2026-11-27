import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, promises as fs } from 'node:fs'
import { isAbsolute, join, resolve as resolvePath } from 'node:path'
import { app } from 'electron'
import type { Settings, YoutubeFormatOption, YoutubeProbe, YoutubeMeta } from '@shared/types'
import { manifestKind } from '@shared/urls'
import type { EngineHost, TaskHandle } from './http'
import { ensureDir, sanitizeFileName } from '../util'
import { currentProxy, proxiedFetch } from '../proxy'

export interface BinInfo {
  cmd: string
  prefix: string[]
  path: string
  version?: string
}

interface RawFormat {
  format_id?: string
  ext?: string
  height?: number | null
  width?: number | null
  vcodec?: string
  acodec?: string
  filesize?: number | null
  filesize_approx?: number | null
  tbr?: number | null
  abr?: number | null
  fps?: number | null
  format_note?: string
  protocol?: string
}

function isDirectFormat(format: RawFormat): boolean {
  const protocol = (format.protocol || '').toLowerCase()
  return protocol === 'http' || protocol === 'https'
}

function isDrcAudio(format: RawFormat): boolean {
  return /-drc$/i.test(format.format_id || '') || /\bdrc\b/i.test(format.format_note || '')
}

/**
 * Prefer formats that download over plain HTTP and can be merged into MP4.
 * YouTube publishes the same height as HLS and direct variants; the HLS
 * variants often carry inflated bitrate values and are the ones that fail
 * with "Requested format is not available" during a later extraction pass.
 * Falling back to HLS only when no direct variant exists keeps the selected
 * quality reliable.
 */
function formatRank(format: RawFormat): number {
  const codec = (format.vcodec || '').toLowerCase()
  const direct = isDirectFormat(format) ? 1_000_000_000 : 0
  const mp4 = (format.ext || '').toLowerCase() === 'mp4' ? 1_000_000 : 0
  const codecRank = codec.startsWith('avc')
    ? 30_000
    : codec.startsWith('av01')
      ? 20_000
      : codec.startsWith('vp9') || codec.startsWith('vp09')
        ? 10_000
        : 0
  return direct + mp4 + codecRank + (format.tbr || 0)
}

function friendlyYoutubeError(raw: string): string {
  const text = (raw || '').replace(/\s+/g, ' ').trim()
  if (/sign in to confirm|not a bot|confirm you.{0,3}re not a bot/i.test(text)) {
    return 'YouTube requested a sign-in check. Open Settings → Tools and add cookies (pick your browser or a cookies.txt file), then retry.'
  }
  if (/private video|members[- ]only|join this channel/i.test(text)) {
    return 'This video is private or members-only. Add cookies from an account with access in Settings → Tools.'
  }
  if (/age[- ]restricted|confirm your age/i.test(text)) {
    return 'This video is age-restricted. Add cookies from a signed-in account in Settings → Tools.'
  }
  if (/requested format is not available|no video formats found/i.test(text)) {
    return 'That quality is not available for this video anymore. Choose Best quality or open the link again.'
  }
  return text
}

function runCapture(
  cmd: string,
  args: string[],
  timeout = 15_000,
  env: Record<string, string> = {}
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let child: ChildProcess
    try {
      child = spawn(cmd, args, {
        windowsHide: true,
        ...(Object.keys(env).length ? { env: { ...process.env, ...env } } : {})
      })
    } catch {
      resolve({ code: -1, stdout: '', stderr: 'spawn failed' })
      return
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        /* ignore */
      }
    }, timeout)
    child.stdout?.on('data', (d) => {
      stdout += d.toString()
      if (stdout.length > 8_000_000) stdout = stdout.slice(-1_000_000)
    })
    child.stderr?.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: -1, stdout, stderr: stderr + err.message })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code, stdout, stderr })
    })
  })
}

function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true })
    } catch {
      child.kill()
    }
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    } catch {
      child.kill('SIGTERM')
    }
  }
}

export function bundledBin(name: string): string {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const candidates = [
    join(process.resourcesPath || '', 'bin', exe),
    join(app.getAppPath(), 'resources', 'bin', exe),
    join(app.getAppPath(), '..', 'resources', 'bin', exe),
    join(app.getPath('userData'), 'bin', exe)
  ]
  return candidates.find((p) => existsSync(p)) || ''
}

interface JsRuntime {
  /** yt-dlp runtime spec, for example "node" or "node:C:\\...\\Pulse.exe". */
  spec: string
  /** Extra environment variables the runtime process needs. */
  env: Record<string, string>
}

export class YoutubeEngine {
  private host: EngineHost
  private binCache: BinInfo | null = null
  private childs = new Map<string, ChildProcess>()
  private ffmpegCache: string | null | undefined = undefined
  private jsRuntimeCache: JsRuntime | null | undefined = undefined
  private latestCache: { version: string; at: number } | null = null
  versionCache = ''

  constructor(host: EngineHost) {
    this.host = host
  }

  async resolveBin(force = false): Promise<BinInfo | null> {
    if (this.binCache && !force) return this.binCache
    const settings = this.host.settings()
    const candidates: Array<{ cmd: string; prefix: string[] }> = []

    if (settings.ytDlpPath && existsSync(settings.ytDlpPath)) {
      candidates.push({ cmd: settings.ytDlpPath, prefix: [] })
    }
    const bundled = bundledBin('yt-dlp')
    if (bundled) candidates.push({ cmd: bundled, prefix: [] })
    candidates.push({ cmd: 'yt-dlp', prefix: [] })
    if (process.platform === 'win32') {
      candidates.push({
        cmd: join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'Scripts', 'yt-dlp.exe'),
        prefix: []
      })
    }
    candidates.push({ cmd: 'python', prefix: ['-m', 'yt_dlp'] })
    candidates.push({ cmd: 'python3', prefix: ['-m', 'yt_dlp'] })

    for (const candidate of candidates) {
      if (candidate.cmd.includes('\\') || candidate.cmd.includes('/')) {
        if (!existsSync(candidate.cmd)) continue
      }
      const res = await runCapture(candidate.cmd, [...candidate.prefix, '--version'], 12_000)
      if (res.code === 0 && /^\d{4}\.\d{2}\.\d{2}/m.test(res.stdout)) {
        const version = (res.stdout.match(/\d{4}\.\d{2}\.\d{2}[^\s]*/) || [res.stdout.trim()])[0]
        this.binCache = { ...candidate, path: candidate.cmd, version }
        this.versionCache = version
        return this.binCache
      }
    }
    this.binCache = null
    return null
  }

  async resolveFfmpeg(): Promise<string | null> {
    if (this.ffmpegCache !== undefined) return this.ffmpegCache
    const settings = this.host.settings()
    const candidates = [
      settings.ffmpegPath,
      bundledBin('ffmpeg'),
      process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    ].filter(Boolean)

    const locate = async (cmd: string): Promise<string | null> => {
      if (isAbsolute(cmd) || cmd.includes('\\') || cmd.includes('/')) {
        return existsSync(cmd) ? resolvePath(cmd) : null
      }
      // `where`/`which` gives yt-dlp the absolute path it needs for
      // --ffmpeg-location (a bare "ffmpeg.exe" would be resolved against CWD).
      const finder = process.platform === 'win32' ? 'where.exe' : 'which'
      const found = await runCapture(finder, [cmd], 6_000)
      if (found.code !== 0) return null
      return (
        found.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .find(Boolean) || null
      )
    }

    for (const candidate of candidates) {
      const path = await locate(candidate)
      if (!path) continue
      const res = await runCapture(path, ['-version'], 10_000)
      if (res.code === 0 && /ffmpeg version/i.test(res.stdout + res.stderr)) {
        this.ffmpegCache = path
        return path
      }
    }
    this.ffmpegCache = null
    return null
  }

  /**
   * yt-dlp 2026+ can use an external JavaScript runtime to solve YouTube's
   * challenge scripts. Node is the preferred runtime. On clean machines where
   * Node is not installed, the running Electron executable can act as Node
   * when ELECTRON_RUN_AS_NODE is set.
   */
  private async resolveJsRuntime(): Promise<JsRuntime | null> {
    if (this.jsRuntimeCache !== undefined) return this.jsRuntimeCache
    const candidates = process.platform === 'win32' ? ['node.exe', 'node'] : ['node']
    for (const cmd of candidates) {
      const res = await runCapture(cmd, ['--version'], 6_000)
      if (res.code === 0 && /^v\d+\.\d+/m.test(res.stdout.trim())) {
        this.jsRuntimeCache = { spec: 'node', env: {} }
        return this.jsRuntimeCache
      }
    }
    if (process.execPath) {
      const env = { ELECTRON_RUN_AS_NODE: '1' }
      const res = await runCapture(process.execPath, ['--version'], 8_000, env)
      const version = (res.stdout || res.stderr).trim()
      if (res.code === 0 && /^v\d+\.\d+/m.test(version)) {
        this.jsRuntimeCache = { spec: `node:${process.execPath}`, env }
        return this.jsRuntimeCache
      }
    }
    this.jsRuntimeCache = null
    return null
  }

  /** `--js-runtimes` only exists in yt-dlp 2025.11 and newer. */
  private supportsJsRuntime(): boolean {
    const parts = this.versionCache.split('.').map((n) => Number(n))
    const [year, month] = parts
    if (!Number.isFinite(year) || !Number.isFinite(month)) return false
    return year > 2025 || (year === 2025 && month >= 11)
  }

  private async jsRuntime(): Promise<{ args: string[]; env: Record<string, string> }> {
    if (!this.supportsJsRuntime()) return { args: [], env: {} }
    const runtime = await this.resolveJsRuntime()
    return runtime ? { args: ['--js-runtimes', runtime.spec], env: runtime.env } : { args: [], env: {} }
  }

  private cookieArgs(): string[] {
    const settings = this.host.settings()
    if (settings.cookiesFile && existsSync(settings.cookiesFile)) {
      return ['--cookies', settings.cookiesFile]
    }
    if (settings.cookiesBrowser) {
      return ['--cookies-from-browser', settings.cookiesBrowser]
    }
    return []
  }

  private proxyArgs(): string[] {
    const proxy = currentProxy()
    return proxy ? ['--proxy', proxy.url] : []
  }

  /**
   * Browser-captured streams need the page's Referer and Cookie, otherwise
   * most CDNs answer with 403. yt-dlp has dedicated flags for the two common
   * headers and accepts everything else through --add-header.
   */
  private headerArgs(headers?: Record<string, string>): string[] {
    const args: string[] = []
    for (const [rawName, rawValue] of Object.entries(headers || {})) {
      const name = rawName.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64)
      const value = String(rawValue || '').replace(/[\r\n]/g, ' ').trim()
      if (!name || !value || value.length > 8192) continue
      if (name.toLowerCase() === 'user-agent') args.push('--user-agent', value)
      else if (name.toLowerCase() === 'referer') args.push('--referer', value)
      else args.push('--add-header', `${name}:${value}`)
    }
    return args
  }

  async status(): Promise<{
    ytdlp: { available: boolean; version?: string; path?: string }
    ffmpeg: { available: boolean; path?: string }
  }> {
    const bin = await this.resolveBin()
    const ffmpeg = await this.resolveFfmpeg()
    return {
      ytdlp: bin
        ? { available: true, version: bin.version, path: bin.path }
        : { available: false },
      ffmpeg: ffmpeg ? { available: true, path: ffmpeg } : { available: false }
    }
  }

  /** Clears the binary caches and probes everything again. */
  async rescan(): Promise<{
    ytdlp: { available: boolean; version?: string; path?: string }
    ffmpeg: { available: boolean; path?: string }
  }> {
    this.binCache = null
    this.ffmpegCache = undefined
    const status = await this.status()
    this.versionCache = status.ytdlp.version || ''
    return status
  }

  async probe(url: string, headers: Record<string, string> = {}): Promise<YoutubeProbe> {
    const bin = await this.resolveBin()
    if (!bin) {
      throw new Error(
        'yt-dlp was not found. Install it from Settings → Tools, or place the binary in the app "bin" folder.'
      )
    }
    const manifest = manifestKind(url)
    const js = await this.jsRuntime()
    const args = [
      ...bin.prefix,
      '-J',
      '--no-warnings',
      '--no-colors',
      '--flat-playlist',
      '--playlist-end',
      '150',
      '--socket-timeout',
      '20',
      '--retries',
      '3',
      ...this.cookieArgs(),
      ...this.proxyArgs(),
      ...this.headerArgs(headers),
      ...js.args,
      url
    ]
    const res = await runCapture(bin.cmd, args, 90_000, js.env)
    if (res.code !== 0 || !res.stdout.trim()) {
      const tail = res.stderr.trim().split('\n').filter(Boolean).slice(-3).join(' ')
      throw new Error(friendlyYoutubeError(tail) || 'yt-dlp could not read this URL')
    }
    let info: Record<string, unknown>
    try {
      info = JSON.parse(res.stdout.slice(res.stdout.indexOf('{')))
    } catch {
      throw new Error('Could not parse yt-dlp metadata')
    }

    if (info._type === 'playlist' || Array.isArray(info.entries)) {
      const rawEntries = (info.entries as Array<Record<string, unknown>>) || []
      const entries = rawEntries
        .filter((e) => e && (e.url || e.webpage_url || e.id))
        .map((e, i) => {
          const thumbs = (e.thumbnails as Array<{ url: string }> | undefined) || []
          const rawUrl = String(e.webpage_url || e.url || '')
          const id = typeof e.id === 'string' ? e.id : ''
          const entryUrl = /^https?:/i.test(rawUrl)
            ? rawUrl
            : id
              ? `https://www.youtube.com/watch?v=${id}`
              : rawUrl
          return {
            url: entryUrl,
            title: String(e.title || `Item ${i + 1}`),
            duration: typeof e.duration === 'number' ? e.duration : undefined,
            thumbnail: thumbs.length ? thumbs[thumbs.length - 1]?.url : typeof e.thumbnail === 'string' ? e.thumbnail : undefined,
            index: i + 1
          }
        })
      return {
        url,
        title: String(info.title || 'Playlist'),
        uploader: typeof info.uploader === 'string' ? info.uploader : undefined,
        isPlaylist: true,
        playlistCount: entries.length,
        entries,
        formats: [],
        vod: manifest ? true : undefined,
        manifest: manifest || undefined
      }
    }

    const formats = (info.formats as RawFormat[]) || []
    const thumbnails = (info.thumbnails as Array<{ url: string }> | undefined) || []
    return {
      url,
      title: String(info.title || 'Untitled'),
      uploader: (info.uploader || info.channel || info.creator) as string | undefined,
      duration: typeof info.duration === 'number' ? info.duration : undefined,
      thumbnail:
        (typeof info.thumbnail === 'string' && info.thumbnail) ||
        thumbnails[thumbnails.length - 1]?.url,
      extractor: (info.extractor_key || info.extractor) as string | undefined,
      viewCount: typeof info.view_count === 'number' ? info.view_count : undefined,
      uploadDate: typeof info.upload_date === 'string' ? info.upload_date : undefined,
      isPlaylist: false,
      formats: this.buildFormats(formats, await this.resolveFfmpeg()),
      vod: manifest ? true : undefined,
      manifest: manifest || undefined
    }
  }

  private buildFormats(raw: RawFormat[], ffmpeg: string | null): YoutubeFormatOption[] {
    const usable = raw.filter((f) => {
      const proto = (f.protocol || '').toLowerCase()
      return f.format_id && !proto.startsWith('mhtml')
    })
    const videos = usable.filter(
      (f) => f.vcodec && f.vcodec !== 'none' && (f.height || 0) > 0
    )
    const audios = usable.filter((f) => f.acodec && f.acodec !== 'none' && f.vcodec === 'none')
    const progressive = usable.filter(
      (f) => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none' && (f.height || 0) > 0
    )
    const bestAudio = audios
      .slice()
      .sort((a, b) => {
        // DRC variants are normalized for loudness and are not the original
        // mix. Keep them as a fallback, not as the default audio stream.
        const drc = Number(isDrcAudio(a)) - Number(isDrcAudio(b))
        if (drc) return drc
        const m4a = Number((b.ext || '').toLowerCase() === 'm4a') - Number((a.ext || '').toLowerCase() === 'm4a')
        if (m4a) return m4a
        return (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0)
      })[0]
    const options: YoutubeFormatOption[] = []

    const heights = Array.from(new Set(videos.map((v) => v.height as number))).sort(
      (a, b) => b - a
    )
    const sizeOf = (f?: RawFormat): number | undefined =>
      f ? f.filesize || f.filesize_approx || undefined : undefined

    options.push({
      id: 'best',
      height: 0,
      ext: 'mp4',
      selector: audios.length ? 'bestvideo*+bestaudio/best' : 'best',
      audioOnly: false,
      label: 'Best quality',
      note: ffmpeg ? 'auto merge' : 'single file'
    })

    for (const height of heights) {
      const candidates = videos.filter((v) => v.height === height)
      // Prefer a direct HTTP variant at this height. HLS variants are kept as
      // a fallback for sites where they are the only source.
      const direct = candidates.filter(isDirectFormat)
      const best = (direct.length ? direct : candidates)
        .slice()
        .sort((a, b) => formatRank(b) - formatRank(a))[0]
      if (!best?.format_id) continue
      const prog = progressive
        .filter((p) => p.height === height)
        .slice()
        .sort((a, b) => formatRank(b) - formatRank(a))[0]
      // Without ffmpeg separate streams cannot be merged, so prefer a muxed
      // variant when this height has no progressive one.
      const muxedCandidate = !ffmpeg
        ? candidates
            .filter((c) => c.acodec && c.acodec !== 'none')
            .sort((a, b) => formatRank(b) - formatRank(a))[0]
        : undefined
      const chosen = !ffmpeg ? prog || muxedCandidate || best : best
      // A muxed stream already contains audio, so it is selected on its own.
      // Only video-only streams are paired with the best audio track.
      const muxed = !!chosen.acodec && chosen.acodec !== 'none'
      const heightFallback = `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
      const selector = muxed || !ffmpeg
        ? `${chosen.format_id}/${heightFallback}`
        : bestAudio?.format_id
          ? `${chosen.format_id}+${bestAudio.format_id}/${chosen.format_id}+bestaudio/${heightFallback}`
          : `${chosen.format_id}+bestaudio/${heightFallback}`
      const videoSize = sizeOf(chosen) || 0
      const audioSize = !muxed && bestAudio ? sizeOf(bestAudio) || 0 : 0
      const size = videoSize || audioSize ? videoSize + audioSize : undefined
      const fps = chosen.fps && chosen.fps > 30 ? `${Math.round(chosen.fps)}fps` : ''
      options.push({
        id: String(chosen.format_id),
        height,
        ext: chosen.ext || 'mp4',
        fps: chosen.fps || undefined,
        vcodec: chosen.vcodec,
        acodec: muxed ? chosen.acodec : bestAudio?.acodec,
        filesize: size,
        tbr: chosen.tbr || undefined,
        selector,
        label: `${height}p${fps ? ' ' + fps : ''}`,
        note: chosen.format_note
      })
    }

    if (bestAudio) {
      options.push({
        id: 'audio-m4a',
        height: 0,
        ext: 'm4a',
        audioOnly: true,
        selector: `${bestAudio.format_id}/bestaudio`,
        filesize: sizeOf(bestAudio),
        label: 'Audio · M4A',
        note: ffmpeg ? 'original stream' : 'original'
      })
      if (ffmpeg) {
        options.push({
          id: 'audio-mp3',
          height: 0,
          ext: 'mp3',
          audioOnly: true,
          selector: 'bestaudio/best',
          label: 'Audio · MP3 320k',
          note: 'converted'
        })
      }
    }
    options.push({
      id: 'audio',
      height: 0,
      ext: 'm4a',
      audioOnly: true,
      selector: 'bestaudio/best',
      label: 'Audio only',
      note: 'best'
    })
    return options
  }

  getRunning(id: string): boolean {
    return this.childs.has(id)
  }

  stop(id: string): void {
    const child = this.childs.get(id)
    if (child) killTree(child)
  }

  async start(handle: TaskHandle, opts: { audioOnly?: boolean; extractAudio?: boolean; subtitles?: boolean; thumbnail?: boolean }): Promise<void> {
    const task = handle.task
    const settings = this.host.settings()
    const bin = await this.resolveBin()
    if (!bin) {
      handle.patch({
        status: 'error',
        error: 'yt-dlp is not installed. Open Settings → Tools to download it automatically.'
      })
      return
    }
    const ffmpeg = await this.resolveFfmpeg()
    await ensureDir(task.dir)
    if (handle.signal.aborted) return

    let selector =
      task.youtube?.formatId ||
      task.youtube?.quality ||
      (task.youtube?.vod ? 'best' : 'bestvideo*+bestaudio/best')
    if (opts.audioOnly) selector = 'bestaudio/best'
    if (!ffmpeg && selector.includes('+')) {
      // Without ffmpeg yt-dlp cannot merge separate video/audio streams.
      selector = 'best[ext=mp4]/best'
      handle.toast('info', 'ffmpeg is missing. Downloading the best single-file format instead.')
    }
    const outputTemplate = join(task.dir, '%(title).120B [%(id)s].%(ext)s')
    const js = await this.jsRuntime()
    const args = [
      ...bin.prefix,
      '--no-warnings',
      '--no-colors',
      '--newline',
      '--no-playlist',
      '--continue',
      '--no-mtime',
      '--retries',
      '10',
      '--fragment-retries',
      '10',
      '--concurrent-fragments',
      '4',
      '--socket-timeout',
      '20',
      '--progress-template',
      'PULSE|%(progress.status)s|%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s',
      '-f',
      selector,
      '-o',
      outputTemplate,
      ...this.cookieArgs(),
      ...this.proxyArgs(),
      ...this.headerArgs(task.headers)
    ]
    args.push(...js.args)
    if (process.platform === 'win32') args.push('--windows-filenames')
    if (ffmpeg) args.push('--ffmpeg-location', ffmpeg)
    if (settings.globalSpeedLimit > 0) {
      args.push('--limit-rate', `${Math.round(settings.globalSpeedLimit / 1024)}K`)
    }
    if (opts.audioOnly && ffmpeg) {
      args.push('--extract-audio', '--audio-format', opts.extractAudio ? 'mp3' : 'm4a')
      if (opts.extractAudio) args.push('--audio-quality', '0')
    }
    if (opts.subtitles && ffmpeg) {
      args.push('--write-subs', '--embed-subs', '--sub-langs', 'en.*,fa.*,fa')
    }
    if (opts.thumbnail && ffmpeg) {
      args.push('--write-thumbnail', '--convert-thumbnails', 'jpg', '--embed-thumbnail')
    }
    args.push('--', task.url)

    const meta: YoutubeMeta = { ...(task.youtube || { title: task.name }), title: task.name }
    handle.patch({ status: 'downloading', error: undefined, connections: 1, youtube: meta })

    await new Promise<void>((resolve) => {
      const startedAt = Date.now()
      const child = spawn(bin.cmd, args, {
        windowsHide: true,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8', ...js.env }
      })
      this.childs.set(task.id, child)
      let stdout = ''
      let stderr = ''
      let lastEmit = 0
      let lastSize = 0

      let finished = false
      const finish = (fn: () => void): void => {
        if (finished) return
        finished = true
        this.childs.delete(task.id)
        fn()
        resolve()
      }

      const handleLine = (line: string): void => {
        if (line.startsWith('PULSE|')) {
          const parts = line.split('|')
          const num = (v?: string): number => {
            const n = Number(v)
            return Number.isFinite(n) && n > 0 ? n : 0
          }
          const total = num(parts[3]) || num(parts[4])
          const downloaded = num(parts[2])
          if (total) lastSize = total
          const now = Date.now()
          if (now - lastEmit > 150) {
            lastEmit = now
            handle.patch({
              downloaded,
              size: total || lastSize,
              ...(total ? {} : {})
            })
          }
          return
        }
        if (line.startsWith('[download] Destination:')) {
          const p = line.replace('[download] Destination:', '').trim()
          if (p) handle.patch({ filePath: p, fileName: p.split(/[\\/]/).pop() })
          return
        }
        if (line.startsWith('[Merger] Merging formats into')) {
          const m = /"(.*)"/.exec(line)
          if (m) {
            handle.patch({ filePath: m[1], fileName: m[1].split(/[\\/]/).pop() })
          }
        }
      }

      child.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
        const lines = stdout.split(/\r?\n/)
        stdout = lines.pop() || ''
        for (const line of lines) handleLine(line.trim())
      })
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
        if (stderr.length > 200_000) stderr = stderr.slice(-60_000)
      })
      child.on('error', (err) => {
        finish(() => {
          handle.patch({
            status: 'error',
            error: `Could not start yt-dlp: ${err.message}`,
            speed: 0,
            eta: 0,
            connections: 0
          })
        })
      })
      child.on('close', async (code) => {
        if (handle.signal.aborted) {
          finish(() => {
            handle.patch({ status: 'paused', speed: 0, eta: 0, connections: 0 })
          })
          return
        }
        if (code === 0) {
          const found = await this.findOutput(task.dir, task.youtube?.videoId || '', startedAt)
          let finalSize = lastSize
          if (found) {
            try {
              finalSize = (await fs.stat(found)).size
            } catch {
              /* keep the downloaded byte count */
            }
          }
          finish(() => {
            handle.patch({
              status: 'completed',
              downloaded: finalSize,
              size: finalSize,
              completedAt: Date.now(),
              speed: 0,
              eta: 0,
              connections: 0,
              filePath: found || task.filePath,
              fileName: found ? found.split(/[\\/]/).pop() : task.fileName
            })
          })
          return
        }
        const tail = stderr
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('WARNING'))
          .slice(-4)
          .join(' ')
        finish(() => {
          handle.patch({
            status: 'error',
            error: friendlyYoutubeError(tail) || `yt-dlp exited with code ${code}`,
            speed: 0,
            eta: 0,
            connections: 0
          })
        })
      })
      handle.signal.addEventListener(
        'abort',
        () => {
          killTree(child)
          setTimeout(() => {
            finish(() => handle.patch({ status: 'paused', speed: 0, eta: 0, connections: 0 }))
          }, 400)
        },
        { once: true }
      )
    })
  }

  private async findOutput(dir: string, videoId: string, since = 0): Promise<string | null> {
    try {
      const entries = await fs.readdir(dir)
      const candidates = entries
        .filter((e) => (videoId ? e.includes(videoId) : true))
        .filter((e) => !e.endsWith('.part') && !e.endsWith('.ytdl') && !e.endsWith('.pulse-part'))
        .filter((e) => !/\.(jpg|webp|png|vtt|srt|ass)$/i.test(e))
      if (!candidates.length) return null
      const stats = await Promise.all(
        candidates.map(async (c) => ({ c, st: await fs.stat(join(dir, c)).catch(() => null) }))
      )
      const files = stats.filter((s) => s.st && s.st.isFile()) as Array<{
        c: string
        st: Awaited<ReturnType<typeof fs.stat>>
      }>
      if (!files.length) return null
      // Prefer files touched by this run; fall back to the biggest match.
      const fresh = since ? files.filter((f) => Number(f.st.mtimeMs) >= since - 60_000) : files
      const pool = fresh.length ? fresh : files
      pool.sort((a, b) => Number(b.st.size) - Number(a.st.size))
      return join(dir, pool[0].c)
    } catch {
      return null
    }
  }

  /**
   * Latest stable yt-dlp release tag from GitHub. The result is cached for
   * thirty minutes so opening Settings repeatedly does not exhaust the
   * anonymous API rate limit.
   */
  async latestVersion(force = false): Promise<string | null> {
    const now = Date.now()
    if (!force && this.latestCache && now - this.latestCache.at < 30 * 60_000) {
      return this.latestCache.version
    }
    try {
      const res = await proxiedFetch(
        'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',
        {
          headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': `Pulse/${app.getVersion()}`
          },
          signal: AbortSignal.timeout(15_000)
        }
      )
      if (!res.ok) return this.latestCache?.version ?? null
      const data = (await res.json()) as { tag_name?: string }
      const version = String(data.tag_name || '')
        .trim()
        .replace(/^v/i, '')
      if (!/^\d{4}\.\d{2}\.\d{2}(?:\.\d+)?$/.test(version)) {
        return this.latestCache?.version ?? null
      }
      this.latestCache = { version, at: now }
      return version
    } catch {
      return this.latestCache?.version ?? null
    }
  }

  async install(): Promise<{ ok: boolean; message: string }> {
    if (this.childs.size > 0) {
      return {
        ok: false,
        message: 'Pause or finish active video downloads before updating yt-dlp.'
      }
    }
    const dir = join(app.getPath('userData'), 'bin')
    await fs.mkdir(dir, { recursive: true })
    const exe = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    // Linux releases ship a standalone build. The plain "yt-dlp" asset is a
    // Python zipapp and needs an interpreter that clean machines may not have.
    const asset =
      process.platform === 'win32'
        ? 'yt-dlp.exe'
        : process.arch === 'arm64'
          ? 'yt-dlp_linux_aarch64'
          : 'yt-dlp_linux'
    const target = join(dir, exe)
    const temp = `${target}.download`
    const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`
    try {
      const res = await proxiedFetch(url, { redirect: 'follow' })
      if (!res.ok) return { ok: false, message: `Download failed: HTTP ${res.status}` }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 1_000_000) {
        return { ok: false, message: 'Downloaded file looks corrupted. Try again later.' }
      }
      await fs.writeFile(temp, buf)
      if (process.platform !== 'win32') await fs.chmod(temp, 0o755)
      // Replace the previous binary only after the download is complete.
      await fs.rename(temp, target)
      this.binCache = null
      this.latestCache = null
      const bin = await this.resolveBin(true)
      if (bin && resolvePath(bin.path) === resolvePath(target)) {
        this.latestCache = { version: bin.version || '', at: Date.now() }
      }
      return {
        ok: !!bin,
        message: bin ? `yt-dlp ${bin.version} installed` : 'Installed, but the binary could not run.'
      }
    } catch (err) {
      await fs.rm(temp, { force: true }).catch(() => undefined)
      const message = (err as Error).message
      if (/EPERM|EBUSY|EACCES/i.test(message)) {
        return { ok: false, message: 'Could not replace yt-dlp because the file is in use. Close other downloads and try again.' }
      }
      return { ok: false, message }
    }
  }

  sanitize(name: string): string {
    return sanitizeFileName(name)
  }
}
