declare module 'chokidar' {
  interface WatchOptions {
    ignored?: string | string[] | RegExp | ((path: string) => boolean)
    persistent?: boolean
    ignoreInitial?: boolean
    awaitWriteFinish?: boolean | { stabilityThreshold?: number; pollInterval?: number }
    [key: string]: unknown
  }

  interface FSWatcher {
    on(event: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir', handler: (path: string) => void): FSWatcher
    on(event: 'error', handler: (error: Error) => void): FSWatcher
    on(event: string, handler: (...args: unknown[]) => void): FSWatcher
    close(): Promise<void>
  }

  export function watch(paths: string | string[], options?: WatchOptions): FSWatcher
}
