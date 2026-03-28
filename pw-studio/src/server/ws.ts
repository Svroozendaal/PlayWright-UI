import type { Server as HttpServer } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'

export type BroadcastMessage = {
  channel: string
  data: unknown
}

export type BroadcastFn = (channel: string, data: unknown) => void

/**
 * Attach a WebSocket server to the HTTP server and expose a broadcast helper.
 *
 * Params:
 * server - HTTP server that owns the `/ws` upgrade path.
 *
 * Returns:
 * WebSocket server instance together with a `broadcast()` helper.
 */
export function createSocketServer(server: HttpServer): {
  socketServer: WebSocketServer
  broadcast: BroadcastFn
} {
  const socketServer = new WebSocketServer({ server, path: '/ws' })
  const clients = new Set<WebSocket>()

  socketServer.on('connection', (client) => {
    clients.add(client)
    client.on('close', () => {
      clients.delete(client)
    })
  })

  const broadcast: BroadcastFn = (channel, data) => {
    const message = JSON.stringify({ channel, data } satisfies BroadcastMessage)

    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(message)
      }
    }
  }

  return { socketServer, broadcast }
}
