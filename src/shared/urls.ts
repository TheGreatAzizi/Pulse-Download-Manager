const VIDEO_PLATFORM_HOSTS = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com',
  'dailymotion.com',
  'soundcloud.com',
  'twitch.tv',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'instagram.com',
  'facebook.com'
]

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0', '[::]'])

/** Maximum number of links accepted in one batch. */
export const MAX_BATCH_URLS = 200

/** Maximum clipboard size that will be scanned for a batch. */
export const MAX_CLIPBOARD_TEXT = 50_000

/** True for sites handled by the app's online-video (yt-dlp) engine. */
export function isVideoPlatformUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return VIDEO_PLATFORM_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname.toLowerCase())
}

/** True for URLs that point at the local machine. */
export function isLocalUrl(raw: string): boolean {
  try {
    return isLocalHostname(new URL(raw).hostname)
  } catch {
    return false
  }
}

/**
 * Batch downloads accept only remote, direct HTTP(S) URLs. Video platforms,
 * magnets and local addresses are intentionally excluded.
 */
export function isDirectBatchUrl(raw: string): boolean {
  if (!raw || raw.length > 4096) return false
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (!url.hostname) return false
    if (isLocalHostname(url.hostname)) return false
    return !isVideoPlatformUrl(url.toString())
  } catch {
    return false
  }
}

function isUrlLike(raw: string): boolean {
  if (!raw || raw.length > 4096) return false
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'magnet:'
  } catch {
    return false
  }
}

export interface ClipboardUrlScan {
  /** URL-shaped lines found in the clipboard, in order and deduplicated. */
  urls: string[]
  /** The subset that can be added through the batch flow. */
  direct: string[]
}

/**
 * Extract URL-shaped lines from a clipboard value. Notes, comments and blank
 * lines are ignored so a numbered list or a short note with links still works.
 * The scan is bounded to keep the clipboard watcher cheap.
 */
export function scanClipboardUrls(raw: string): ClipboardUrlScan {
  if (!raw || raw.length > MAX_CLIPBOARD_TEXT) return { urls: [], direct: [] }
  const urls: string[] = []
  const seen = new Set<string>()
  for (const line of raw.split(/\r?\n/)) {
    const value = line.trim()
    if (!value || value.startsWith('#')) continue
    if (!isUrlLike(value)) continue
    if (seen.has(value)) continue
    seen.add(value)
    urls.push(value)
    if (urls.length >= MAX_BATCH_URLS) break
  }
  return { urls, direct: urls.filter(isDirectBatchUrl) }
}
