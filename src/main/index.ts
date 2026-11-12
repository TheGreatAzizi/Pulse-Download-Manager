import { app, BrowserWindow, Menu, clipboard, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import { app as electronApp } from 'electron'
import { Store } from './store'
import { DownloadManager } from './manager'
import { registerIpc } from './ipc'
import { IP } from '@shared/ipc'
import type { MainEvent } from '@shared/types'

let mainWindow: BrowserWindow | null = null
let manager: DownloadManager
let store: Store
let clipboardTimer: NodeJS.Timeout | null = null
let lastClipboard = ''

const gotLock = electronApp.requestSingleInstanceLock()
if (!gotLock) {
  electronApp.quit()
}
function send(event: MainEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IP.event, event)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: '#0a0c12',
    title: 'Pulse',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('maximize', () => send({ type: 'window:state', maximized: true }))
  mainWindow.on('unmaximize', () => send({ type: 'window:state', maximized: false }))

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
    if (/^https?:/i.test(url)) void shell.openExternal(url)
  })

  // Keep useful keyboard shortcuts even though the native menu is hidden.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    if (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow?.webContents.toggleDevTools()
      event.preventDefault()
    }
    if (ctrl && input.key.toLowerCase() === 'r' && input.shift) {
      mainWindow?.webContents.reload()
      event.preventDefault()
    }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startClipboardWatcher(): void {
  if (clipboardTimer) clearInterval(clipboardTimer)
  clipboardTimer = setInterval(async () => {
    if (!manager.settings().clipboardWatch) return
    const text = (await clipboard.readText()).trim()
    if (!text || text === lastClipboard) return
    lastClipboard = text
    if (!/^(https?:\/\/|magnet:)/i.test(text) || text.length > 4096) return
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(text)) return
    send({ type: 'clipboard:url', url: text })
  }, 1600)
}

async function bootstrap(): Promise<void> {
  await electronApp.whenReady()
  electronApp.setAppUserModelId('com.pulse.downloadmanager')
  Menu.setApplicationMenu(null)
  nativeTheme.themeSource = 'dark'

  store = new Store()
  await store.load()

  manager = new DownloadManager({ store, emit: send })
  await manager.init()

  registerIpc(manager, () => mainWindow)
  createWindow()
  startClipboardWatcher()

  electronApp.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
    const url = argv.find((a) => /^(https?:\/\/|magnet:)/i.test(a))
    if (url) setTimeout(() => send({ type: 'open-add', url }), 800)
  })

  electronApp.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

electronApp.on('window-all-closed', () => {
  if (process.platform !== 'darwin') electronApp.quit()
})

let quitting = false
electronApp.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  quitting = true
  if (clipboardTimer) clearInterval(clipboardTimer)
  void (async () => {
    try {
      await manager?.shutdown()
    } finally {
      electronApp.exit(0)
    }
  })()
})

process.on('uncaughtException', (err) => {
  console.error('[main] uncaught exception:', err)
})

if (gotLock) void bootstrap()
