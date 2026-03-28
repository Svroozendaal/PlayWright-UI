import { useEffect, useRef } from 'react'

type SocketHandler<T> = (data: T) => void
type Listener = (data: unknown) => void
type SocketMessage = {
  channel: string
  data: unknown
}

const listeners = new Map<string, Set<Listener>>()

let socket: WebSocket | null = null
let reconnectTimer: number | null = null

function getSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

function dispatchMessage(message: SocketMessage): void {
  const channelListeners = listeners.get(message.channel)
  if (!channelListeners) {
    return
  }

  for (const listener of channelListeners) {
    listener(message.data)
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null || listeners.size === 0) {
    return
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    ensureSocket()
  }, 1000)
}

function ensureSocket(): void {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return
  }

  clearReconnectTimer()
  socket = new WebSocket(getSocketUrl())

  socket.addEventListener('message', (event) => {
    try {
      dispatchMessage(JSON.parse(event.data) as SocketMessage)
    } catch (error) {
      console.error('[pw-studio] invalid socket message', error)
    }
  })

  socket.addEventListener('close', () => {
    socket = null
    scheduleReconnect()
  })

  socket.addEventListener('error', () => {
    socket?.close()
  })
}

function closeSocketIfIdle(): void {
  if (listeners.size > 0 || !socket) {
    return
  }

  socket.close()
  socket = null
  clearReconnectTimer()
}

function subscribe(channel: string, listener: Listener): () => void {
  const channelListeners = listeners.get(channel) ?? new Set<Listener>()
  channelListeners.add(listener)
  listeners.set(channel, channelListeners)
  ensureSocket()

  return () => {
    const currentListeners = listeners.get(channel)
    if (!currentListeners) {
      return
    }

    currentListeners.delete(listener)
    if (currentListeners.size === 0) {
      listeners.delete(channel)
    }

    closeSocketIfIdle()
  }
}

export function useSocketEvent<T>(channel: string, handler: SocketHandler<T>): void {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    return subscribe(channel, (data) => {
      handlerRef.current(data as T)
    })
  }, [channel])
}
