import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { WS_EVENTS } from '../../shared/types/ipc'
import type { CodegenOptions, RecorderStatus, RecorderStatusEvent } from '../../shared/types/ipc'
import { getPlaywrightBinary } from '../utils/playwrightBinary'

function quoteArgsForShell(args: string[]): string[] {
  if (process.platform !== 'win32') return args
  return args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg))
}

export class RecorderService {
  private activeProcess: ChildProcess | null = null

  private status: RecorderStatus = 'idle'

  private publish: (channel: string, data: unknown) => void

  private lastError: string | null = null

  constructor(publish: (channel: string, data: unknown) => void) {
    this.publish = publish
  }

  start(rootPath: string, options: CodegenOptions): void {
    if (this.activeProcess) {
      throw new RecorderAlreadyRunningError('A codegen session is already running')
    }

    const binary = getPlaywrightBinary(rootPath)
    if (!fs.existsSync(binary)) {
      throw new Error(`Playwright binary not found at: ${binary}`)
    }

    const outputDir = path.dirname(options.outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const args: string[] = ['codegen']

    if (options.browser) {
      args.push(`--browser=${options.browser}`)
    }

    if (options.outputPath) {
      args.push('-o', options.outputPath)
    }

    if (options.startUrl) {
      args.push(options.startUrl)
    }

    const cleanEnv = { ...process.env }

    const isWindows = process.platform === 'win32'
    const safeBinary = isWindows && binary.includes(' ') ? `"${binary}"` : binary

    console.log('[recorder] spawning:', safeBinary, args.join(' '))

    const proc = spawn(safeBinary, quoteArgsForShell(args), {
      cwd: rootPath,
      shell: isWindows,
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.setEncoding('utf8')
    proc.stderr?.setEncoding('utf8')

    this.activeProcess = proc
    this.status = 'running'
    this.lastError = null
    this.notifyStatus()

    let stderrBuffer = ''

    proc.stdout?.on('data', (data: string) => {
      console.log('[recorder stdout]', data)
    })

    proc.stderr?.on('data', (data: string) => {
      stderrBuffer += data
      console.error('[recorder stderr]', data)
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

    proc.on('error', (error: Error) => {
      this.activeProcess = null
      this.lastError = error.message
      this.status = 'idle'
      this.notifyStatus()
    })
  }

  stop(): void {
    if (!this.activeProcess) {
      return
    }

    const proc = this.activeProcess

    if (process.platform === 'win32') {
      import('child_process').then(({ execSync }) => {
        try {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { timeout: 5000 })
        } catch {
          // Process may have already exited.
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
    const payload: RecorderStatusEvent = {
      status: this.status,
      error: this.lastError ?? undefined,
    }
    this.publish(WS_EVENTS.RECORDER_STATUS, payload)
  }
}

export class RecorderAlreadyRunningError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecorderAlreadyRunningError'
  }
}
