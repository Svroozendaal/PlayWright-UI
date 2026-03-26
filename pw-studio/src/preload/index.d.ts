import type { IpcEnvelope } from '../shared/types/ipc'

declare global {
  interface Window {
    api: {
      invoke: <T>(channel: string, payload?: unknown) => Promise<IpcEnvelope<T>>
      on: (channel: string, handler: (...args: unknown[]) => void) => void
      off: (channel: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export {}
