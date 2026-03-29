import fs from 'fs'
import path from 'path'
import { spawn, execFile } from 'child_process'
import type { ChildProcess } from 'child_process'

export function getPlaywrightBinary(rootPath: string): string {
  const isWindows = process.platform === 'win32'
  return path.join(
    rootPath,
    'node_modules',
    '.bin',
    isWindows ? 'playwright.cmd' : 'playwright'
  )
}

function getShellSafeBinary(rootPath: string): string {
  const binary = getPlaywrightBinary(rootPath)
  if (process.platform === 'win32' && binary.includes(' ')) {
    return `"${binary}"`
  }
  return binary
}

export function spawnPlaywright(
  args: string[],
  rootPath: string,
  extraEnv?: Record<string, string>
): ChildProcess {
  const isWindows = process.platform === 'win32'
  // On Windows with shell: true, arguments containing spaces must be quoted
  // so cmd.exe doesn't split them at the space boundary.
  const safeArgs = isWindows
    ? args.map((a) => (a.includes(' ') ? `"${a}"` : a))
    : args
  return spawn(getShellSafeBinary(rootPath), safeArgs, {
    cwd: rootPath,
    shell: isWindows,
    env: { ...process.env, ...extraEnv },
  })
}

/**
 * Get Playwright version from the installed package.json.
 * More reliable than running the binary (avoids shell/spawn issues on Windows).
 */
export function getPlaywrightVersion(rootPath: string): string {
  // Strategy 1: Read from @playwright/test package.json (most reliable)
  const pkgPath = path.join(rootPath, 'node_modules', '@playwright', 'test', 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string }
      if (pkg.version) return pkg.version
    } catch {
      // Fall through to binary
    }
  }

  // Strategy 2: Read from playwright package.json
  const corePkgPath = path.join(rootPath, 'node_modules', 'playwright', 'package.json')
  if (fs.existsSync(corePkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(corePkgPath, 'utf8')) as { version?: string }
      if (pkg.version) return pkg.version
    } catch {
      // Fall through
    }
  }

  return 'unknown'
}

export function checkPlaywrightCommand(
  rootPath: string,
  args: string[],
  callback: (error: Error | null) => void
): void {
  const isWindows = process.platform === 'win32'
  const safeArgs = isWindows
    ? args.map((a) => (a.includes(' ') ? `"${a}"` : a))
    : args
  execFile(
    getShellSafeBinary(rootPath),
    safeArgs,
    {
      cwd: rootPath,
      timeout: 15000,
      shell: isWindows,
    },
    (error) => callback(error)
  )
}
