import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import { WS_EVENTS } from '../../shared/types/ipc'
import type {
  CodegenOptions,
  RecorderSaveResult,
  RecorderStatus,
  RecorderStatusEvent,
} from '../../shared/types/ipc'
import type { PluginRuntimeService } from '../plugins/runtime'
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

  private activeOptions: CodegenOptions | null = null

  private activeRootPath: string | null = null

  private lastResult: RecorderSaveResult | null = null

  constructor(
    publish: (channel: string, data: unknown) => void,
    private readonly pluginRuntime: PluginRuntimeService
  ) {
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

    // Resolve outputPath to absolute so fs calls and spawn args agree
    const absoluteOutputPath = path.isAbsolute(options.outputPath)
      ? options.outputPath
      : path.join(rootPath, options.outputPath)
    const resolvedOptions: CodegenOptions = { ...options, outputPath: absoluteOutputPath }

    const outputDir = path.dirname(absoluteOutputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    if (resolvedOptions.preludeCode) {
      fs.writeFileSync(absoluteOutputPath, resolvedOptions.preludeCode, 'utf8')
    }

    const args: string[] = ['codegen']

    if (resolvedOptions.browser) {
      args.push(`--browser=${resolvedOptions.browser}`)
    }

    if (absoluteOutputPath) {
      args.push('-o', absoluteOutputPath)
    }

    if (resolvedOptions.storageState) {
      args.push(`--load-storage=${resolvedOptions.storageState}`)
    }

    if (resolvedOptions.startUrl) {
      args.push(resolvedOptions.startUrl)
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
    this.activeRootPath = rootPath
    this.activeOptions = resolvedOptions
    this.lastResult = null
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
        this.activeOptions = null
        this.activeRootPath = null
        this.lastError = stderrBuffer.trim() || `Codegen exited with code ${exitCode}`
        this.status = 'idle'
        this.notifyStatus()
        return
      }

      const result = this.activeOptions
        ? this.buildRecorderResult(this.activeOptions)
        : null

      this.activeOptions = null
      this.activeRootPath = null
      this.status = 'idle'
      this.notifyStatus(result ?? undefined)
    })

    proc.on('error', (error: Error) => {
      this.activeProcess = null
      this.activeOptions = null
      this.activeRootPath = null
      this.lastResult = null
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
    this.activeOptions = null
    this.activeRootPath = null
    this.lastResult = null
    this.status = 'idle'
    this.notifyStatus()
  }

  getStatus(): RecorderStatus {
    return this.status
  }

  getLastError(): string | null {
    return this.lastError
  }

  getOutputFile(outputPath: string): RecorderSaveResult | null {
    if (this.lastResult?.outputPath === outputPath && fs.existsSync(outputPath)) {
      return this.lastResult
    }

    if (fs.existsSync(outputPath)) {
      return this.buildRecorderResult({ outputPath }, path.dirname(outputPath))
    }
    return null
  }

  private buildRecorderResult(options: CodegenOptions, rootPath = this.activeRootPath ?? path.dirname(options.outputPath)): RecorderSaveResult | null {
    if (!fs.existsSync(options.outputPath)) {
      return null
    }

    const originalContent = fs.readFileSync(options.outputPath, 'utf8')
    const refined = this.pluginRuntime.applyRecorderTransforms({
      rootPath,
      outputPath: options.outputPath,
      content: originalContent,
      startUrl: options.startUrl,
      browser: options.browser,
    })

    if (refined.content !== originalContent) {
      fs.writeFileSync(options.outputPath, refined.content, 'utf8')
    }

    const result: RecorderSaveResult = {
      outputPath: options.outputPath,
      testTitle: refined.testTitle ?? path.basename(options.outputPath, path.extname(options.outputPath)),
      transformed: refined.content !== originalContent,
      actionCount: refined.appliedChanges?.length ?? 0,
      appliedChanges: refined.appliedChanges ?? [],
      extractions: refined.extractions ?? [],
      suggestions: refined.suggestions ?? [],
    }

    this.lastResult = result
    return result
  }

  private notifyStatus(result?: RecorderSaveResult): void {
    const payload: RecorderStatusEvent = {
      status: this.status,
      error: this.lastError ?? undefined,
      result,
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
