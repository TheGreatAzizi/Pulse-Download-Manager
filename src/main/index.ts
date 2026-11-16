import { app, BrowserWindow, Menu, clipboard, nativeTheme, shell, Tray, nativeImage } from 'electron'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app as electronApp } from 'electron'
import { Store } from './store'
import { DownloadManager } from './manager'
import { registerIpc } from './ipc'
import { applyLaunchAtStartup } from './autostart'
import { IP } from '@shared/ipc'
import type { MainEvent } from '@shared/types'
import { isClipboardUrlCandidate, isDirectBatchUrl } from '@shared/urls'

let mainWindow: BrowserWindow | null = null
let manager: DownloadManager
let store: Store
let clipboardTimer: NodeJS.Timeout | null = null
let lastClipboard = ''
let tray: Tray | null = null

// Windows reads the taskbar name and icon from the AppUserModelID at process
// start. Setting these before `ready` is what makes the taskbar show "Pulse"
// and the Pulse icon instead of Electron's defaults. The explicit userData
// path keeps existing profiles at %APPDATA%\pulse-download-manager.
electronApp.setName('Pulse')
electronApp.setAppUserModelId('com.pulse.downloadmanager.app')
electronApp.setPath(
  'userData',
  join(electronApp.getPath('appData'), 'pulse-download-manager')
)

const gotLock = electronApp.requestSingleInstanceLock()
if (!gotLock) {
  electronApp.quit()
}
function send(event: MainEvent): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IP.event, event)
  }
}

/**
 * Early development builds could leave an "Electron.lnk" in the Start Menu
 * that points at node_modules\electron\dist\electron.exe but carries Pulse's
 * AppUserModelID. Windows then uses that shortcut's name and Electron icon for
 * the taskbar button, even when the packaged Pulse.exe is running.
 */
function removeStaleElectronShortcut(): void {
  if (process.platform !== 'win32') return
  const programs = join(
    electronApp.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  )
  const aumids = ['com.pulse.downloadmanager', 'com.pulse.downloadmanager.app'].map((id) =>
    Buffer.from(id, 'utf16le')
  )
  const electronExe = Buffer.from('electron.exe', 'utf16le')
  for (const name of ['Electron.lnk', 'Pulse.lnk']) {
    const file = join(programs, name)
    try {
      if (!existsSync(file)) continue
      const data = readFileSync(file)
      if (aumids.some((id) => data.includes(id)) && data.includes(electronExe)) {
        unlinkSync(file)
      }
    } catch {
      /* The shortcut may be locked; the window icon still applies. */
    }
  }
}

function appIconPath(): string {
  return electronApp.isPackaged
    ? join(process.resourcesPath, process.platform === 'win32' ? 'icon.ico' : 'icon.png')
    : join(__dirname, '../../resources', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1420,
    height: 900,
    minWidth: 1040,
    minHeight: 640,
    show: false,
    frame: false,
    backgroundColor: store.settings.theme === 'dark' ? '#0a0c12' : '#f4f6fb',
    title: 'Pulse',
    icon: appIconPath(),
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

  if (process.platform === 'win32') {
    // The taskbar button keeps its own app details. Without this, Windows can
    // fall back to Electron's name/icon even though the window icon is Pulse.
    mainWindow.setAppDetails({
      appId: 'com.pulse.downloadmanager.app',
      appIconPath: appIconPath(),
      appIconIndex: 0,
      relaunchCommand: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
      relaunchDisplayName: 'Pulse'
    })
  }

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

  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

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

    // Treat a newline-separated list as a batch only when every entry is
    // URL-shaped. Keep only direct HTTP(S) URLs: magnet and yt-dlp platforms
    // are intentionally excluded from Batch Download.
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    if (lines.length > 1) {
      if (lines.every(isClipboardUrlCandidate)) {
        const urls = [...new Set(lines.filter(isDirectBatchUrl))]
        if (urls.length > 1) {
          send({ type: 'clipboard:batch', urls })
        } else if (urls.length === 1) {
          send({ type: 'clipboard:url', url: urls[0] })
        }
      }
      return
    }

    if (!/^(https?:\/\/|magnet:)/i.test(text) || text.length > 4096) return
    if (/^https?:\/\/(localhost|127\.0\.0\.1)/i.test(text)) return
    send({ type: 'clipboard:url', url: text })
  }, 1600)
}

function createTray(): void {
  const image = nativeImage.createFromPath(appIconPath())
  tray = new Tray(image.resize({ width: 24, height: 24 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Pulse',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore()
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        electronApp.quit()
      }
    }
  ])

  tray.setToolTip('Pulse Download Manager')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

async function bootstrap(): Promise<void> {
  await electronApp.whenReady()
  Menu.setApplicationMenu(null)

  store = new Store()
  await store.load()
  nativeTheme.themeSource = store.settings.theme
  void applyLaunchAtStartup(store.settings.launchAtStartup)

  manager = new DownloadManager({ store, emit: send })
  await manager.init()

  registerIpc(manager, () => mainWindow)
  removeStaleElectronShortcut()
  createWindow()
  createTray()
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
  // Keep app running for tray on Windows/Linux
  if (process.platform !== 'darwin') {
    mainWindow?.hide()
  }
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
