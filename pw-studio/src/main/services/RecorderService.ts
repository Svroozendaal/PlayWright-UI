import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import type { BrowserWindow } from 'electron'
import { IPC } from '../../shared/types/ipc'
import type { CodegenOptions, RecorderStatus } from '../../shared/types/ipc'
import { getPlaywrightBinary } from '../utils/playwrightBinary'

function quoteArgsForShell(args: string[]): string[] {
  if (process.platform !== 'win32') return args
  return args.map((a) => (a.includes(' ') ? `"${a}"` : a))
}

export class RecorderService {
  private activeProcess: ChildProcess | null = null
  private status: RecorderStatus = 'idle'
  private win: BrowserWindow
  private lastError: string | null = null

  constructor(win: BrowserWindow) {
    this.win = win
  }

  start(rootPath: string, options: CodegenOptions): void {
    if (this.activeProcess) {
      throw new RecorderAlreadyRunningError('A codegen session is already running')
    }

    // Verify the binary exists
    const binary = getPlaywrightBinary(rootPath)
    if (!fs.existsSync(binary)) {
      throw new Error(`Playwright binary not found at: ${binary}`)
    }

    // Ensure output directory exists
    const outputDir = path.dirname(options.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const args: string[] = ['codegen']

    if (options.browser) {
      args.push(`--browser=${options.browser}`)
    }

    if (options.outputPath) {
      args.push(`-o`, options.outputPath)
    }

    if (options.startUrl) {
      args.push(options.startUrl)
    }

    // Strip Electron-specific env vars to prevent interference with codegen
    const cleanEnv = { ...process.env }
    delete cleanEnv['ELECTRON_RUN_AS_NODE']
    delete cleanEnv['ELECTRON_NO_ASAR']

    console.log('[recorder] spawning:', binary, args.join(' '))

    const isWindows = process.platform === 'win32'
    const proc = spawn(binary, quoteArgsForShell(args), {
      cwd: rootPath,
      shell: isWindows,
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    this.activeProcess = proc
    this.status = 'running'
    this.lastError = null
    this.notifyStatus()

    let stderrBuffer = ''

    proc.stdout?.on('data', (data: Buffer) => {
      // Codegen may output to stdout — just collect for debugging
      console.log('[recorder stdout]', data.toString('utf8'))
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString('utf8')
      stderrBuffer += text
      console.error('[recorder stderr]', text)
    })

    proc.on('close', (exitCode: number | null) => {
      this.activeProcess = null

      if (exitCode !== 0 && exitCode !== null) {
        this.lastError = stderrBuffer.trim() || `Codegen exited with code ${exitCode}`
        this.status = 'idle'
        this.notifyStatus()
        return
      }

      this.status = 'idle'
      this.notifyStatus()
    })

    proc.on('error', (err: Error) => {
      this.activeProcess = null
      this.lastError = err.message
      this.status = 'idle'
      this.notifyStatus()
    })
  }

  stop(): void {
    if (!this.activeProcess) return

    const proc = this.activeProcess

    if (process.platform === 'win32') {
      import('child_process').then(({ execSync }) => {
        try {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { timeout: 5000 })
        } catch {
          // Process may have already exited
        }
      })
    } else {
      proc.kill('SIGTERM')
      setTimeout(() => {
        if (this.activeProcess === proc) {
          proc.kill('SIGKILL')
        }
      }, 3000)
    }

    this.activeProcess = null
    this.status = 'idle'
    this.notifyStatus()
  }

  getStatus(): RecorderStatus {
    return this.status
  }

  getLastError(): string | null {
    return this.lastError
  }

  getOutputFile(outputPath: string): string | null {
    if (fs.existsSync(outputPath)) {
      return outputPath
    }
    return null
  }

  private notifyStatus(): void {
    this.win.webContents.send(IPC.RECORDER_STATUS, {
      status: this.status,
      error: this.lastError,
    })
  }
}

export class RecorderAlreadyRunningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecorderAlreadyRunningError'
  }
}
