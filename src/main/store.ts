import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DownloadTask, Settings } from '@shared/types'
import { DEFAULT_QUEUE_ID, makeDefaultQueue, normalizeQueues, resolveQueueId } from '@shared/queues'
import { defaultDownloadDir } from './util'

interface Persisted {
  version: number
  tasks: DownloadTask[]
  settings: Settings
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export function defaultSettings(): Settings {
  return {
    downloadDir: defaultDownloadDir(),
    maxConcurrent: 3,
    connections: 8,
    globalSpeedLimit: 0,
    language: 'en',
    theme: 'light',
    clipboardWatch: true,
    notifyOnComplete: true,
    ytDlpPath: '',
    ffmpegPath: '',
    torrentPort: 0,
    seedAfterComplete: false,
    proxy: '',
    userAgent: DEFAULT_UA,
    autoResume: true,
    launchAtStartup: true,
    startMinimized: true,
    cookiesBrowser: '',
    cookiesFile: '',
    githubToken: '',
    browserIntegration: true,
    multiNetwork: false,
    networkAdapters: [],
    queues: [makeDefaultQueue()],
    defaultQueueId: DEFAULT_QUEUE_ID
  }
}

export class Store {
  private file: string
  private data: Persisted
  private timer: NodeJS.Timeout | null = null
  private writing = false
  private dirty = false

  constructor() {
    const dir = app.getPath('userData')
    this.file = join(dir, 'pulse-state.json')
    this.data = { version: 1, tasks: [], settings: defaultSettings() }
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw) as Partial<Persisted>
      const defaults = defaultSettings()
      const settings = { ...defaults, ...(parsed.settings || {}) } as Settings
      settings.queues = normalizeQueues(settings.queues)
      settings.defaultQueueId = resolveQueueId(settings.queues, settings.defaultQueueId)
      const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map((task) => ({
        ...task,
        queueId: resolveQueueId(settings.queues, task.queueId)
      }))
      this.data = {
        version: 1,
        tasks,
        settings
      }
      if (!this.data.settings.downloadDir) this.data.settings.downloadDir = defaults.downloadDir
    } catch {
      this.data = { version: 1, tasks: [], settings: defaultSettings() }
    }
  }

  get tasks(): DownloadTask[] {
    return this.data.tasks
  }

  set tasks(list: DownloadTask[]) {
    this.data.tasks = list
    this.scheduleSave()
  }

  get settings(): Settings {
    return this.data.settings
  }

  patchSettings(patch: Partial<Settings>): Settings {
    this.data.settings = { ...this.data.settings, ...patch }
    this.scheduleSave()
    return this.data.settings
  }

  scheduleSave(): void {
    this.dirty = true
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, 700)
  }

  async flush(): Promise<void> {
    if (this.writing) {
      this.dirty = true
      return
    }
    this.writing = true
    this.dirty = false
    try {
      const tmp = `${this.file}.tmp`
      const payload = JSON.stringify(
        { version: 1, tasks: this.data.tasks, settings: this.data.settings },
        null,
        0
      )
      await fs.mkdir(join(this.file, '..'), { recursive: true })
      await fs.writeFile(tmp, payload, 'utf8')
      await fs.rename(tmp, this.file)
    } catch (err) {
      console.error('[store] save failed', err)
    } finally {
      this.writing = false
      if (this.dirty) this.scheduleSave()
    }
  }

  async dispose(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }
}
