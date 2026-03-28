import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import type Database from 'better-sqlite3'
import type { HealthItem, HealthSnapshot, HealthStatus } from '../../shared/types/ipc'
import { checkPlaywrightCommand, getPlaywrightVersion } from '../utils/playwrightBinary'
import type { PlaywrightConfigService } from './PlaywrightConfigService'

export class ProjectHealthService {
  private db: Database.Database
  private configService: PlaywrightConfigService

  constructor(db: Database.Database, configService: PlaywrightConfigService) {
    this.db = db
    this.configService = configService
  }

  get(projectId: string): HealthSnapshot | null {
    const row = this.db
      .prepare('SELECT * FROM project_health_snapshots WHERE projectId = ?')
      .get(projectId) as { projectId: string; checkedAt: string; status: string; payloadJson: string } | undefined

    if (!row) return null

    const age = Date.now() - new Date(row.checkedAt).getTime()
    if (age > 3_600_000) return null // 1 hour TTL

    const items = JSON.parse(row.payloadJson) as HealthItem[]
    // Map DB enum back: 'healthy' → 'pass'
    const overallStatus: HealthStatus = row.status === 'healthy' ? 'pass' : row.status as HealthStatus
    return {
      projectId: row.projectId,
      checkedAt: row.checkedAt,
      overallStatus,
      items,
    }
  }

  async refresh(projectId: string, rootPath: string): Promise<HealthSnapshot> {
    const items: HealthItem[] = []

    items.push(await checkNode())
    items.push(await checkNpm())
    items.push(checkPlaywrightPackage(rootPath))
    items.push(checkPlaywrightVersionItem(rootPath))
    items.push(checkPlaywrightConfig(rootPath))

    const configSummary = this.configService.get(projectId, rootPath)
    items.push(checkConfigReadable(configSummary.readMethod))
    items.push(checkTestDir(configSummary.testDir, configSummary.readMethod))
    items.push(await checkBrowserInstall(rootPath))

    const overallStatus = deriveOverall(items)
    const now = new Date().toISOString()

    const snapshot: HealthSnapshot = {
      projectId,
      checkedAt: now,
      overallStatus,
      items,
    }

    // Map in-app status to DB enum: 'pass' → 'healthy'
    const dbStatus = overallStatus === 'pass' ? 'healthy' : overallStatus

    // Upsert into database
    this.db
      .prepare(
        `INSERT INTO project_health_snapshots (projectId, checkedAt, status, payloadJson)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(projectId) DO UPDATE SET checkedAt = ?, status = ?, payloadJson = ?`
      )
      .run(projectId, now, dbStatus, JSON.stringify(items), now, dbStatus, JSON.stringify(items))

    return snapshot
  }

  invalidateCache(projectId: string): void {
    this.db.prepare('DELETE FROM project_health_snapshots WHERE projectId = ?').run(projectId)
  }
}

function deriveOverall(items: HealthItem[]): HealthStatus {
  if (items.some((i) => i.status === 'error')) return 'error'
  if (items.some((i) => i.status === 'warning')) return 'warning'
  return 'pass'
}

function checkNode(): Promise<HealthItem> {
  return new Promise((resolve) => {
    execFile('node', ['--version'], { timeout: 10_000 }, (err, stdout) => {
      if (err) {
        resolve({ check: 'node', status: 'error', message: 'Node.js not found', actionHint: 'Install Node.js 20+' })
        return
      }
      const version = stdout.trim()
      const major = parseInt(version.replace('v', ''), 10)
      if (major < 20) {
        resolve({
          check: 'node',
          status: 'error',
          message: `Node.js ${version} found, minimum 20.x required`,
          value: version,
          actionHint: 'Upgrade Node.js to 20+',
        })
      } else {
        resolve({ check: 'node', status: 'pass', message: `Node.js ${version}`, value: version })
      }
    })
  })
}

function checkNpm(): Promise<HealthItem> {
  return new Promise((resolve) => {
    execFile('npm', ['--version'], { timeout: 10_000, shell: process.platform === 'win32' }, (err, stdout) => {
      if (err) {
        resolve({ check: 'npm', status: 'error', message: 'npm not found', actionHint: 'Install npm' })
        return
      }
      const version = stdout.trim()
      resolve({ check: 'npm', status: 'pass', message: `npm ${version}`, value: version })
    })
  })
}

function checkPlaywrightPackage(rootPath: string): HealthItem {
  const pkgPath = path.join(rootPath, 'node_modules', '@playwright', 'test', 'package.json')
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string }
      return {
        check: 'playwrightPackage',
        status: 'pass',
        message: `@playwright/test ${pkg.version ?? 'installed'}`,
        value: pkg.version,
      }
    } catch {
      return { check: 'playwrightPackage', status: 'warning', message: 'Could not read package info' }
    }
  }
  return {
    check: 'playwrightPackage',
    status: 'error',
    message: '@playwright/test not installed',
    actionHint: 'Run: npm install @playwright/test',
  }
}

function checkPlaywrightVersionItem(rootPath: string): HealthItem {
  const version = getPlaywrightVersion(rootPath)
  if (version === 'unknown') {
    return {
      check: 'playwrightVersion',
      status: 'error',
      message: 'Could not determine Playwright version',
      actionHint: 'Run: npm install @playwright/test',
    }
  }

  const parts = version.split('.').map(Number)
  const major = parts[0] ?? 0
  const minor = parts[1] ?? 0
  if (major < 1 || (major === 1 && minor < 40)) {
    return {
      check: 'playwrightVersion',
      status: 'error',
      message: `Playwright ${version} found, minimum 1.40.0 required`,
      value: version,
      actionHint: 'Run: npm install @playwright/test@latest',
    }
  }

  return { check: 'playwrightVersion', status: 'pass', message: `Playwright ${version}`, value: version }
}

function checkPlaywrightConfig(rootPath: string): HealthItem {
  const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']
  for (const f of configFiles) {
    if (fs.existsSync(path.join(rootPath, f))) {
      return { check: 'playwrightConfig', status: 'pass', message: `Found ${f}` }
    }
  }
  return {
    check: 'playwrightConfig',
    status: 'error',
    message: 'No playwright.config found',
    actionHint: 'Create a playwright.config.ts in the project root',
  }
}

function checkConfigReadable(readMethod: 'config' | 'regex' | 'fallback'): HealthItem {
  if (readMethod === 'config' || readMethod === 'regex') {
    return { check: 'configReadable', status: 'pass', message: `Config parsed successfully (${readMethod})` }
  }
  return {
    check: 'configReadable',
    status: 'warning',
    message: 'Config could not be read, using defaults',
    actionHint: 'Check playwright.config.ts for syntax errors',
  }
}

function checkTestDir(testDir: string, readMethod: 'config' | 'regex' | 'fallback'): HealthItem {
  const exists = fs.existsSync(testDir)
  if (exists && readMethod !== 'fallback') {
    return { check: 'testDir', status: 'pass', message: `Test directory: ${testDir}` }
  }
  if (exists && readMethod === 'fallback') {
    return {
      check: 'testDir',
      status: 'warning',
      message: `Using fallback test directory: ${testDir}`,
      actionHint: 'Fix config to resolve testDir automatically',
    }
  }
  return {
    check: 'testDir',
    status: 'error',
    message: `Test directory not found: ${testDir}`,
    actionHint: `Create the directory: ${testDir}`,
  }
}

function checkBrowserInstall(rootPath: string): Promise<HealthItem> {
  // Check the Playwright browsers directory on disk.
  // Playwright stores browsers in a well-known location per platform.
  const browsersDir = getBrowsersDir()
  if (browsersDir && fs.existsSync(browsersDir)) {
    try {
      const entries = fs.readdirSync(browsersDir)
      // Playwright browser dirs are named like "chromium-1234", "firefox-1234", etc.
      const browserDirs = entries.filter(
        (e) => /^(chromium|firefox|webkit|ffmpeg)-/.test(e)
      )
      if (browserDirs.length > 0) {
        return Promise.resolve({
          check: 'browserInstall',
          status: 'pass',
          message: `${browserDirs.length} browser(s) found in ${browsersDir}`,
        })
      }
    } catch {
      // Fall through to inconclusive
    }
  }

  // Fallback: try running playwright to list browsers
  return new Promise((resolve) => {
    checkPlaywrightCommand(rootPath, ['--version'], (err) => {
      if (err) {
        resolve({
          check: 'browserInstall',
          status: 'warning',
          message: 'Could not verify browser installation',
          actionHint: 'Run: npx playwright install',
        })
      } else {
        // Binary works but we couldn't find the browsers dir — assume OK
        resolve({
          check: 'browserInstall',
          status: 'pass',
          message: 'Playwright binary available',
        })
      }
    })
  })
}

function getBrowsersDir(): string | null {
  // Respect PLAYWRIGHT_BROWSERS_PATH if set
  if (process.env['PLAYWRIGHT_BROWSERS_PATH']) {
    return process.env['PLAYWRIGHT_BROWSERS_PATH']
  }

  // Default locations per platform
  if (process.platform === 'win32') {
    const localAppData = process.env['LOCALAPPDATA']
    if (localAppData) return path.join(localAppData, 'ms-playwright')
  } else if (process.platform === 'darwin') {
    const home = process.env['HOME']
    if (home) return path.join(home, 'Library', 'Caches', 'ms-playwright')
  } else {
    const home = process.env['HOME']
    if (home) return path.join(home, '.cache', 'ms-playwright')
  }

  return null
}
