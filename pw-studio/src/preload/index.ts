import { contextBridge, ipcRenderer } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
const listenerMap = new Map<Function, (...args: unknown[]) => void>()

contextBridge.exposeInMainWorld('api', {
  invoke: <T>(channel: string, payload?: unknown): Promise<T> =>
    ipcRenderer.invoke(channel, { version: 1, payload }),

  on: (channel: string, handler: (...args: unknown[]) => void): void => {
    const wrapper = (_event: unknown, ...args: unknown[]): void => handler(...args)
    listenerMap.set(handler, wrapper)
    ipcRenderer.on(channel, wrapper)
  },

  off: (channel: string, handler: (...args: unknown[]) => void): void => {
    const wrapper = listenerMap.get(handler)
    if (wrapper) {
      ipcRenderer.removeListener(channel, wrapper)
      listenerMap.delete(handler)
    }
  },
})
