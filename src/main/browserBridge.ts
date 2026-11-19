import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import type { IncomingMessage } from 'node:http'
import { join } from 'node:path'
import { app, shell, type BrowserWindow } from 'electron'
import { WebSocket, WebSocketServer, type RawData } from 'ws'
import type { BrowserStatus, DownloadTask } from '@shared/types'
import type { DownloadManager } from './manager'

/**
 * Localhost bridge used by the Pulse Chrome/Edge extension.
 *
 * The server binds to 127.0.0.1 only and rejects every WebSocket handshake
 * whose Origin is not the exact extension ID embedded in extension/manifest.json.
 * The ID is derived from the manifest's public key, so the origin cannot be
 * spoofed by another extension.
 */

const PORTS = [19527, 19528, 19529, 19530]
const PROTOCOL = 1
const MAX_CLIENTS = 8
const MAX_PAYLOAD = 256 * 1024
const HELLO_TIMEOUT = 6000
const MAX_ADDS_PER_MINUTE = 120
const MAX_MESSAGES_PER_WINDOW = 300
const MESSAGE_WINDOW = 10_000
const MAX_BATCH = 50
const MAX_URL_LENGTH = 4096
const MAX_COOKIE_LENGTH = 16 * 1024
const MAX_REFERRER_LENGTH = 2048
const MAX_UA_LENGTH = 512

/** Public key from extension/manifest.json. Keep the two files in sync. */
const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzwjHHuDKjQugB1XFRmKKAMolB67Od+sA/2bEDnkmC9b8DHUPWZtStkyKXMJMb0/nefCt1Exhdp91GzQJq9VDJeaLPAhLUaPVjVrOELCmnMMPyjteVYd8I+URVgcpm7fTTyazhYn/ONyIwpiSuRQnZx6abkz1Vr1F/UP4xvF9KTQ7lsSSHn5Ve4yM3LDz52Nco86gAjyRFJ6HKkpAS6Zjn26PXCRqLGLMnPQ3hxgL87vXsuzhFhqkZ9/8+asRVfENhpMZ+mrhviPV06l7q1LcwD6d/lt9SiQNPOgTjMwj50RByGOgMNKCyUqZdM4DYDopM1M1LdWZ3NjmDiLhpCQtzwIDAQAB'

function extensionIdFromKey(key: string): string {
  const der = Buffer.from(key, 'base64')
  const digest = createHash('sha256').update(der).digest()
  let id = ''
  for (let i = 0; i < 16; i++) {
    id += String.fromCharCode(97 + (digest[i] >> 4))
    id += String.fromCharCode(97 + (digest[i] & 0x0f))
  }
  return id
}

export const EXTENSION_ID = extensionIdFromKey(EXTENSION_KEY)
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`

interface ClientState {
  ws: WebSocket
  ready: boolean
  hello: NodeJS.Timeout
  adds: number[]
  messages: number[]
}

interface BridgeOptions {
  manager: DownloadManager
  getWindow: () => BrowserWindow | null
  onStatus: (status: BrowserStatus) => void
  onAdded: (task: DownloadTask) => void
}

interface AddResult {
  ok: boolean
  id?: string
  name?: string
  error?: string
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max)
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw || raw.length > MAX_URL_LENGTH) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function cleanReferrer(value: unknown): string {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  if (!raw || raw.length > MAX_REFERRER_LENGTH) return ''
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return ''
    return url.toString()
  } catch {
    return ''
  }
}

function cleanFileName(value: unknown): string {
  const raw = cleanText(value, 240)
  const base = raw.split(/[\\/]/).pop() || ''
  const name = base.replace(/[<>:"|?*]/g, '').trim().replace(/^\.+$/, '')
  return name.slice(0, 180)
}

function cleanCookie(value: unknown): string {
  if (typeof value !== 'string') return ''
  const cookie = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!cookie || cookie.length > MAX_COOKIE_LENGTH) return ''
  return cookie
}

function cleanUserAgent(value: unknown): string {
  if (typeof value !== 'string') return ''
  const ua = value.replace(/[\u0000-\u001f\u007f]/g, '').trim()
  if (!ua || ua.length > MAX_UA_LENGTH) return ''
  return ua
}

function shortError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  return message.replace(/\s+/g, ' ').trim().slice(0, 300) || 'Request failed'
}

export function resolveExtensionPath(): string {
  const candidates = [
    app.isPackaged ? join(process.resourcesPath, 'extension') : join(app.getAppPath(), 'extension'),
    join(app.getAppPath(), 'extension'),
    join(__dirname, '../../extension')
  ]
  return candidates.find((dir) => existsSync(join(dir, 'manifest.json'))) || candidates[0]
}

export class BrowserBridge {
  private readonly manager: DownloadManager
  private readonly getWindow: () => BrowserWindow | null
  private readonly onStatus: (status: BrowserStatus) => void
  private readonly onAdded: (task: DownloadTask) => void
  private readonly extensionPath: string
  private server: WebSocketServer | null = null
  private clients = new Map<WebSocket, ClientState>()
  private ticker: NodeJS.Timeout | null = null
  private enabled: boolean
  private starting = false
  private port = 0
  private error: string | undefined

  constructor(options: BridgeOptions, enabled: boolean) {
    this.manager = options.manager
    this.getWindow = options.getWindow
    this.onStatus = options.onStatus
    this.onAdded = options.onAdded
    this.extensionPath = resolveExtensionPath()
    this.enabled = enabled
  }

  status(): BrowserStatus {
    return {
      enabled: this.enabled,
      running: !!this.server,
      port: this.port,
      clients: this.clients.size,
      extensionPath: this.extensionPath,
      error: this.error
    }
  }

  async start(): Promise<void> {
    if (!this.enabled || this.server || this.starting) return
    this.starting = true
    this.error = undefined
    for (const port of PORTS) {
      try {
        const server = await this.listen(port)
        this.server = server
        this.port = port
        server.on('connection', (ws, req) => this.handleConnection(ws, req))
        this.startTicker()
        break
      } catch (err) {
        const code = (err as NodeJS.ErrnoException).code
        if (code !== 'EADDRINUSE') {
          this.error = shortError(err)
          break
        }
      }
    }
    if (!this.server && !this.error) {
      this.error = 'No free port between 19527 and 19530'
    }
    this.starting = false
    this.emitStatus()
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.enabled === enabled) {
      this.emitStatus()
      return
    }
    this.enabled = enabled
    if (enabled) await this.start()
    else this.stop()
  }

  stop(): void {
    this.stopTicker()
    for (const [ws] of this.clients) {
      try {
        ws.close(1001, 'Pulse bridge stopped')
      } catch {
        /* ignore */
      }
    }
    this.clients.clear()
    const server = this.server
    this.server = null
    this.port = 0
    if (server) {
      try {
        server.close()
      } catch {
        /* ignore */
      }
    }
    this.emitStatus()
  }

  async openFolder(): Promise<void> {
    if (!existsSync(this.extensionPath)) throw new Error('The extension folder is missing')
    const result = await shell.openPath(this.extensionPath)
    if (result) throw new Error(result)
  }

  dispose(): void {
    this.stop()
  }

  private listen(port: number): Promise<WebSocketServer> {
    return new Promise((resolve, reject) => {
      const server = new WebSocketServer({
        host: '127.0.0.1',
        port,
        maxPayload: MAX_PAYLOAD,
        perMessageDeflate: false,
        verifyClient: (info: { origin: string; secure: boolean; req: IncomingMessage }) =>
          this.verifyOrigin(info.req, port)
      })

      let settled = false
      let timer: NodeJS.Timeout
      const finish = (fn: () => void): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        server.removeListener('listening', onListening)
        server.removeListener('error', onError)
        fn()
      }
      const onListening = (): void => {
        finish(() => {
          server.on('error', (err) => {
            this.error = shortError(err)
            this.emitStatus()
          })
          resolve(server)
        })
      }
      const onError = (err: Error): void => {
        finish(() => {
          try {
            server.close()
          } catch {
            /* ignore */
          }
          reject(err)
        })
      }
      timer = setTimeout(() => {
        onError(new Error('Timed out starting the browser bridge'))
      }, 4000)

      server.once('listening', onListening)
      server.once('error', onError)
    })
  }

  private verifyOrigin(req: IncomingMessage, port: number): boolean {
    const origin = String(req.headers.origin || '')
    if (origin !== EXTENSION_ORIGIN) return false
    const host = String(req.headers.host || '').toLowerCase()
    return host === `127.0.0.1:${port}` || host === `localhost:${port}`
  }

  private handleConnection(ws: WebSocket, _req: IncomingMessage): void {
    if (this.clients.size >= MAX_CLIENTS) {
      ws.close(1013, 'Too many connections')
      return
    }
    const state: ClientState = {
      ws,
      ready: false,
      adds: [],
      messages: [],
      hello: setTimeout(() => {
        if (!state.ready) ws.close(1008, 'Hello timeout')
      }, HELLO_TIMEOUT)
    }
    this.clients.set(ws, state)

    ws.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) return
      void this.handleMessage(state, data.toString())
    })
    ws.on('close', () => {
      clearTimeout(state.hello)
      this.clients.delete(ws)
      this.emitStatus()
    })
    ws.on('error', () => {
      /* the close event cleans up */
    })
    this.emitStatus()
  }

  private async handleMessage(state: ClientState, raw: string): Promise<void> {
    const now = Date.now()
    state.messages = state.messages.filter((t) => now - t < MESSAGE_WINDOW)
    state.messages.push(now)
    if (state.messages.length > MAX_MESSAGES_PER_WINDOW) {
      state.ws.close(1008, 'Too many messages')
      return
    }

    let message: Record<string, unknown>
    try {
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return
      message = parsed as Record<string, unknown>
    } catch {
      return
    }
    if (typeof message.type !== 'string') return
    const requestId = typeof message.requestId === 'string' ? message.requestId : undefined

    if (!state.ready) {
      if (message.type !== 'hello') {
        this.respond(state.ws, {
          type: 'error',
          requestId,
          message: 'Say hello before sending requests'
        })
        state.ws.close(1008, 'Hello required')
        return
      }
      if (Number(message.protocol) !== PROTOCOL) {
        this.respond(state.ws, {
          type: 'error',
          requestId,
          message: 'The extension and Pulse versions are not compatible. Update both.'
        })
        state.ws.close(1008, 'Protocol mismatch')
        return
      }
      const version = cleanText(message.version, 32)
      if (!/^\d+\.\d+\.\d+/.test(version)) {
        this.respond(state.ws, {
          type: 'error',
          requestId,
          message: 'Invalid extension version'
        })
        state.ws.close(1008, 'Invalid version')
        return
      }
      state.ready = true
      clearTimeout(state.hello)
      this.respond(state.ws, {
        type: 'welcome',
        protocol: PROTOCOL,
        appVersion: app.getVersion(),
        port: this.port
      })
      this.emitStatus()
      return
    }

    switch (message.type) {
      case 'add': {
        if (!this.allowAdd(state)) {
          this.respond(state.ws, {
            type: 'error',
            requestId,
            message: 'Too many download requests. Wait a moment and try again.'
          })
          return
        }
        const result = await this.addOne(
          cleanUrl(message.url),
          cleanFileName(message.fileName),
          cleanReferrer(message.referrer),
          cleanUserAgent(message.userAgent),
          cleanCookie(message.cookies)
        )
        this.respond(state.ws, {
          type: result.ok ? 'result' : 'error',
          requestId,
          ok: result.ok,
          id: result.id,
          name: result.name,
          message: result.error
        })
        return
      }
      case 'addBatch': {
        const items = Array.isArray(message.items) ? message.items.slice(0, MAX_BATCH) : []
        if (!items.length) {
          this.respond(state.ws, {
            type: 'error',
            requestId,
            message: 'No links were provided'
          })
          return
        }
        const referrer = cleanReferrer(message.referrer)
        const userAgent = cleanUserAgent(message.userAgent)
        const seen = new Set<string>()
        const errors: string[] = []
        let added = 0
        for (const item of items) {
          if (!item || typeof item !== 'object') continue
          const entry = item as Record<string, unknown>
          const url = cleanUrl(entry.url)
          if (!url || seen.has(url)) continue
          seen.add(url)
          if (!this.allowAdd(state)) {
            errors.push('Too many download requests. Wait a moment and try again.')
            break
          }
          const result = await this.addOne(
            url,
            '',
            referrer,
            userAgent,
            cleanCookie(entry.cookies)
          )
          if (result.ok) added++
          else if (errors.length < 5) errors.push(result.error || 'Request failed')
        }
        this.respond(state.ws, {
          type: 'batch',
          requestId,
          ok: added > 0,
          added,
          failed: Math.max(0, seen.size - added),
          errors
        })
        return
      }
      case 'status': {
        this.respond(state.ws, { type: 'status', requestId, ...this.statusPayload() })
        return
      }
      case 'show': {
        this.showWindow()
        this.respond(state.ws, { type: 'result', requestId, ok: true })
        return
      }
      case 'ping': {
        this.respond(state.ws, { type: 'pong', requestId })
        return
      }
      default: {
        this.respond(state.ws, {
          type: 'error',
          requestId,
          message: 'Unknown request'
        })
      }
    }
  }

  private async addOne(
    url: string | null,
    fileName: string,
    referrer: string,
    userAgent: string,
    cookies: string
  ): Promise<AddResult> {
    if (!url) return { ok: false, error: 'Enter a valid HTTP or HTTPS link' }
    const headers: Record<string, string> = {}
    if (userAgent) headers['User-Agent'] = userAgent
    if (referrer) headers.Referer = referrer
    if (cookies) headers.Cookie = cookies
    try {
      const task = await this.manager.addDownload({
        url,
        fileName: fileName || undefined,
        headers: Object.keys(headers).length ? headers : undefined
      })
      this.onAdded(task)
      return { ok: true, id: task.id, name: task.name }
    } catch (err) {
      return { ok: false, error: shortError(err) }
    }
  }

  private allowAdd(state: ClientState): boolean {
    const now = Date.now()
    state.adds = state.adds.filter((t) => now - t < 60_000)
    if (state.adds.length >= MAX_ADDS_PER_MINUTE) return false
    state.adds.push(now)
    return true
  }

  private statusPayload(): {
    appVersion: string
    active: number
    speed: number
    tasks: Array<{
      id: string
      name: string
      status: string
      size: number
      downloaded: number
      speed: number
    }>
  } {
    const tasks = this.manager.list()
    const active = tasks.filter((task) =>
      ['queued', 'connecting', 'downloading', 'verifying'].includes(task.status)
    )
    const speed = tasks.reduce(
      (sum, task) => sum + (task.status === 'downloading' ? task.speed : 0),
      0
    )
    return {
      appVersion: app.getVersion(),
      active: active.length,
      speed,
      tasks: active.slice(0, 6).map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        size: task.size,
        downloaded: task.downloaded,
        speed: task.speed
      }))
    }
  }

  private startTicker(): void {
    this.stopTicker()
    this.ticker = setInterval(() => {
      if (!this.clients.size) return
      const payload = JSON.stringify({ type: 'status', ...this.statusPayload() })
      for (const [ws, state] of this.clients) {
        if (state.ready && ws.readyState === WebSocket.OPEN) ws.send(payload)
      }
    }, 2000)
  }

  private stopTicker(): void {
    if (this.ticker) clearInterval(this.ticker)
    this.ticker = null
  }

  private showWindow(): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }

  private respond(ws: WebSocket, payload: Record<string, unknown>): void {
    if (ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify(payload))
    } catch {
      /* the socket is going away */
    }
  }

  private emitStatus(): void {
    this.onStatus(this.status())
  }
}
