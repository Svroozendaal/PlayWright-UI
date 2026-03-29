import fs from 'fs'
import type { TestResultRecord } from '../../shared/types/ipc'
import crypto from 'crypto'

type PlaywrightJsonSuite = {
  title: string
  suites?: PlaywrightJsonSuite[]
  specs?: PlaywrightJsonSpec[]
}

type PlaywrightJsonSpec = {
  title: string
  file: string
  tests: PlaywrightJsonTest[]
}

type PlaywrightJsonTest = {
  title?: string
  results: PlaywrightJsonResult[]
}

type PlaywrightJsonResult = {
  status: string
  duration: number
  error?: { message?: string }
  attachments?: PlaywrightJsonAttachment[]
  retry: number
}

type PlaywrightJsonAttachment = {
  name: string
  path?: string
  contentType: string
}

type PlaywrightJsonReport = {
  suites: PlaywrightJsonSuite[]
}

export function parseJsonReport(resultsPath: string, runId: string): TestResultRecord[] {
  if (!fs.existsSync(resultsPath)) return []

  const raw = fs.readFileSync(resultsPath, 'utf8')
  const report = JSON.parse(raw) as PlaywrightJsonReport
  const results: TestResultRecord[] = []

  for (const suite of report.suites) {
    collectFromSuite(suite, runId, results)
  }

  return results
}

function collectFromSuite(suite: PlaywrightJsonSuite, runId: string, results: TestResultRecord[]): void {
  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests) {
        const lastResult = test.results[test.results.length - 1]
        if (!lastResult) continue

        const status = mapStatus(lastResult.status)
        const attachments = lastResult.attachments ?? []
        const testTitle = spec.title || test.title || suite.title || 'Unnamed test'

        results.push({
          id: crypto.randomUUID(),
          runId,
          testTitle,
          status,
          duration: lastResult.duration,
          errorMessage: lastResult.error?.message ?? null,
          tracePath: findAttachment(attachments, 'trace'),
          screenshotPath: findAttachment(attachments, 'screenshot'),
          videoPath: findAttachment(attachments, 'video'),
          retryCount: lastResult.retry,
          safeTitleForGrep: escapeForGrep(testTitle),
        })
      }
    }
  }

  if (suite.suites) {
    for (const child of suite.suites) {
      collectFromSuite(child, runId, results)
    }
  }
}

function mapStatus(pwStatus: string): TestResultRecord['status'] {
  switch (pwStatus) {
    case 'passed': return 'passed'
    case 'failed': return 'failed'
    case 'timedOut': return 'timedOut'
    case 'skipped': return 'skipped'
    case 'interrupted': return 'interrupted'
    default: return 'failed'
  }
}

function findAttachment(attachments: PlaywrightJsonAttachment[], type: string): string | null {
  const attachment = attachments.find((a) => a.name === type && a.path)
  return attachment?.path ?? null
}

export function escapeForGrep(title: string): string {
  return title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function determineOutcome(
  exitCode: number | null,
  resultsPath: string | null
): 'passed' | 'failed' | 'config-error' {
  if (exitCode === 0) return 'passed'
  if (resultsPath && fs.existsSync(resultsPath)) {
    try {
      const raw = fs.readFileSync(resultsPath, 'utf8')
      JSON.parse(raw) // Just check it's valid JSON
      return 'failed'
    } catch {
      return 'config-error'
    }
  }
  return 'config-error'
}
