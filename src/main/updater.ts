import { app, shell } from 'electron'
import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import type { UpdateAsset, UpdateInfo } from '@shared/types'
import { proxiedFetch } from './proxy'

const REPO = 'TheGreatAzizi/Pulse-Download-Manager'
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES_PAGE = `https://github.com/${REPO}/releases`

let downloadedPath: string | null = null
let downloadedCanInstall = false

/** Only the latest release asset is ever launched, never a renderer supplied path. */
function isPortable(): boolean {
  return process.platform === 'win32' && !!process.env.PORTABLE_EXECUTABLE_DIR
}

function normalize(version: string): number[] {
  return String(version || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => parseInt(part, 10) || 0)
}

export function compareVersions(a: string, b: string): number {
  const left = normalize(a)
  const right = normalize(b)
  const length = Math.max(left.length, right.length)
  for (let i = 0; i < length; i++) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff) return diff > 0 ? 1 : -1
  }
  return 0
}

function pickAsset(assets: UpdateAsset[], version: string): UpdateAsset | null {
  const find = (name: string): UpdateAsset | null =>
    assets.find((asset) => asset.name === name) || null
  if (process.platform === 'win32') {
    if (!isPortable()) {
      const setup = find(`Pulse-Setup-${version}-x64.exe`)
      if (setup) return setup
    }
    return find(`Pulse-Portable-${version}-x64.exe`)
  }
  if (process.platform === 'linux') {
    return (
      find(`Pulse-${version}-x86_64.AppImage`) ||
      assets.find((asset) => asset.name.endsWith('.AppImage')) ||
      null
    )
  }
  return null
}

export async function check(token?: string): Promise<UpdateInfo> {
  const current = app.getVersion()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': `Pulse/${current}`
  }
  if (token && token.trim()) headers.Authorization = `Bearer ${token.trim()}`

  const res = await proxiedFetch(LATEST_API, { headers })
  if (!res.ok) {
    if (res.status === 403 || res.status === 429) {
      throw new Error('GitHub rate limit reached. Please try again later.')
    }
    if (res.status === 404) throw new Error('No releases were found for this project.')
    throw new Error(`Update check failed (HTTP ${res.status}).`)
  }

  const data = (await res.json()) as {
    tag_name?: string
    name?: string
    body?: string
    published_at?: string
    html_url?: string
    assets?: Array<{ name: string; browser_download_url: string; size: number }>
  }

  const latest = String(data.tag_name || '').replace(/^v/i, '')
  const assets: UpdateAsset[] = (data.assets || []).map((asset) => ({
    name: asset.name,
    url: asset.browser_download_url,
    size: asset.size
  }))
  const hasUpdate = !!latest && compareVersions(latest, current) > 0
  const asset = hasUpdate ? pickAsset(assets, latest) : null

  return {
    current,
    latest: latest || current,
    hasUpdate,
    releaseName: data.name || `Pulse ${latest || current}`,
    notes: (data.body || '').trim(),
    publishedAt: data.published_at || '',
    releaseUrl: data.html_url || RELEASES_PAGE,
    asset,
    canInstall:
      !!asset &&
      process.platform === 'win32' &&
      !isPortable() &&
      asset.name.startsWith('Pulse-Setup-'),
    portable: isPortable()
  }
}

export async function download(
  info: UpdateInfo,
  onProgress: (received: number, total: number) => void
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const asset = info.asset
  if (!asset || !/^https:\/\//i.test(asset.url)) {
    return { ok: false, error: 'No downloadable update is available for this platform.' }
  }
  try {
    const target = join(app.getPath('downloads'), asset.name)
    const res = await proxiedFetch(asset.url, {
      headers: { 'User-Agent': `Pulse/${info.current}`, Accept: 'application/octet-stream' }
    })
    if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status}).`)

    const total = Number(res.headers.get('content-length')) || asset.size || 0
    let received = 0
    let lastEmit = 0
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length
        const now = Date.now()
        if (now - lastEmit > 150) {
          lastEmit = now
          onProgress(received, total)
        }
        callback(null, chunk)
      }
    })
    const source = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream)
    await pipeline(source, counter, createWriteStream(target))
    onProgress(received, total || received)

    downloadedPath = target
    downloadedCanInstall = info.canInstall
    return { ok: true, path: target }
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'The update could not be downloaded.' }
  }
}

export async function install(): Promise<void> {
  if (!downloadedPath || !downloadedCanInstall) {
    throw new Error('No installable update has been downloaded yet.')
  }
  const child = spawn(downloadedPath, [], { detached: true, stdio: 'ignore' })
  child.unref()
  setTimeout(() => app.quit(), 400)
}

export async function reveal(): Promise<void> {
  if (!downloadedPath) throw new Error('No update has been downloaded yet.')
  shell.showItemInFolder(downloadedPath)
}
