import fs from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import { createServer } from 'http'
import express from 'express'
import cors from 'cors'
import { API_ROUTES } from '../shared/types/ipc'
import { openDatabase, closeDatabase } from './db/database'
import { loadPlugins } from './plugins/loader'
import { createServices } from './services/ServiceContainer'
import { registerAllRoutes } from './routes'
import { createSocketServer } from './ws'
import { buildOpenApiDocument } from './openapi'

const DEFAULT_PORT = Number(process.env['PORT'] || 3210)
const DEV_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173']

function getClientBuildDir(): string {
  return path.resolve(__dirname, '../../dist/client')
}

function hasBuiltClient(): boolean {
  return fs.existsSync(path.join(getClientBuildDir(), 'index.html'))
}

async function main(): Promise<void> {
  const app = express()
  const server = createServer(app)
  const { socketServer, broadcast } = createSocketServer(server)
  const events = new EventEmitter()
  const db = openDatabase()
  const services = createServices(db, broadcast, events)
  const pluginManager = await loadPlugins({
    services,
    events,
    runtime: services.pluginRuntime,
    logger: console,
  })
  let shuttingDown = false

  app.use(express.json({ limit: '4mb' }))

  if (!hasBuiltClient()) {
    app.use(
      cors({
        origin: DEV_ORIGINS,
        credentials: false,
      })
    )
  }

  const api = express.Router()
  const registeredRoutes = registerAllRoutes(api, services)

  api.get(API_ROUTES.OPENAPI, (_req, res) => {
    res.json(buildOpenApiDocument(registeredRoutes))
  })

  app.use('/api', api)
  app.use('/api/plugins', pluginManager.router)

  if (hasBuiltClient()) {
    const clientDir = getClientBuildDir()
    app.use(express.static(clientDir))
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/ws') {
        next()
        return
      }
      res.sendFile(path.join(clientDir, 'index.html'))
    })
  }

  const shutdown = (): void => {
    if (shuttingDown) {
      return
    }

    shuttingDown = true
    services.fileWatch.unwatchAll()
    socketServer.close()
    void pluginManager.shutdown()
      .catch((error) => {
        console.error('[pw-studio] plugin shutdown failed', error)
      })
      .finally(() => {
        server.close(() => {
          closeDatabase(db)
          process.exit(0)
        })
      })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  server.listen(DEFAULT_PORT, '127.0.0.1', () => {
    console.log(`[pw-studio] server listening at http://127.0.0.1:${DEFAULT_PORT}`)
    console.log(`[pw-studio] loaded ${pluginManager.plugins.length} plugin(s)`)
    if (!hasBuiltClient()) {
      console.log('[pw-studio] dev frontend expected at http://127.0.0.1:5173')
    }
  })
}

void main().catch((error) => {
  console.error('[pw-studio] fatal startup error', error)
  process.exit(1)
})
