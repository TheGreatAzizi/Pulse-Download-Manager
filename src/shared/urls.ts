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

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/** True for sites handled by the app's online-video (yt-dlp) engine. */
export function isVideoPlatformUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase()
    return VIDEO_PLATFORM_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))
  } catch {
    return false
  }
}

/** Batch downloads accept only remote, direct HTTP(S) URLs—not video platforms or torrents. */
export function isDirectBatchUrl(raw: string): boolean {
  if (!raw || raw.length > 4096) return false

  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    if (!url.hostname || LOCAL_HOSTS.has(url.hostname.toLowerCase())) return false
    return !isVideoPlatformUrl(url.toString())
  } catch {
    return false
  }
}

/** Recognizes URL-shaped clipboard entries before filtering for direct batch links. */
export function isClipboardUrlCandidate(raw: string): boolean {
  if (!raw || raw.length > 4096) return false
  if (/^magnet:/i.test(raw)) return true

  try {
    const url = new URL(raw)
    return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname)
  } catch {
    return false
  }
}
