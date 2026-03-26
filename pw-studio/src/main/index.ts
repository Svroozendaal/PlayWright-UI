import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { openDatabase, closeDatabase } from './db/database'
import { createServices } from './services/ServiceContainer'
import { registerAllHandlers } from './ipc/index'
import type Database from 'better-sqlite3'
import type { ServiceContainer } from './services/ServiceContainer'

let db: Database.Database | null = null
let services: ServiceContainer | null = null

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    title: 'PW Studio',
    show: false,
  })

  // Show window when ready to avoid flash
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Load renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // 1. Open database (creates schema_version + runs migrations)
  db = openDatabase()

  // 2. Create window
  const win = createWindow()

  // 3. Create services with dependencies
  services = createServices(db, win)

  // 4. Register all IPC handlers
  registerAllHandlers(services)
})

// Graceful shutdown
app.on('before-quit', () => {
  // Stop all file watchers
  if (services) {
    services.fileWatch.unwatchAll()
  }

  if (db) {
    closeDatabase(db)
    db = null
  }
})

// Quit when all windows are closed (Windows/Linux behaviour)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
