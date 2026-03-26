import path from 'path'
import type { RunRequest } from '../../shared/types/ipc'

export type ResolvedArtifactPolicy = {
  screenshotMode: 'off' | 'on-failure' | 'always'
  traceMode: 'off' | 'on-failure' | 'always'
  videoMode: 'off' | 'on-failure' | 'always'
}

export function buildCommand(request: RunRequest, runDir: string, artifactPolicy?: ResolvedArtifactPolicy): string[] {
  const args: string[] = ['test']

  // Reporters
  args.push(`--reporter=json:${path.join(runDir, 'results.json')}`)
  args.push('--reporter=html')

  // Browser selection
  if (request.browser.mode === 'single') {
    args.push(`--project=${request.browser.projectName}`)
  }

  // Target (file/folder)
  if (request.targetPath) {
    args.push(request.targetPath)
  }

  // Test filter (from explorer context menu)
  if (request.testTitleFilter) {
    args.push(`--grep=${request.testTitleFilter}`)
  }

  // Advanced grep filter
  if (request.grepPattern && !request.testTitleFilter) {
    args.push(`--grep=${request.grepPattern}`)
  }

  // Grep invert
  if (request.grepInvert && (request.grepPattern || request.testTitleFilter)) {
    args.push('--grep-invert')
  }

  // Tag filter (Playwright @tag syntax via grep)
  if (request.tagFilter) {
    args.push(`--grep=${request.tagFilter}`)
  }

  // Headed mode
  if (request.headed) {
    args.push('--headed')
  }

  // Debug mode
  if (request.debug) {
    args.push('--debug')
  }

  // Output directory
  args.push(`--output=${runDir}`)

  // Artifact flags
  if (artifactPolicy) {
    args.push(...buildArtifactFlags(artifactPolicy))
  }

  return args
}

export function buildArtifactFlags(policy: ResolvedArtifactPolicy): string[] {
  const flags: string[] = []

  flags.push(`--screenshot=${mapScreenshotMode(policy.screenshotMode)}`)
  flags.push(`--video=${mapVideoMode(policy.videoMode)}`)
  flags.push(`--trace=${mapTraceMode(policy.traceMode)}`)

  return flags
}

function mapScreenshotMode(mode: ResolvedArtifactPolicy['screenshotMode']): string {
  switch (mode) {
    case 'off': return 'off'
    case 'on-failure': return 'only-on-failure'
    case 'always': return 'on'
  }
}

function mapVideoMode(mode: ResolvedArtifactPolicy['videoMode']): string {
  switch (mode) {
    case 'off': return 'off'
    case 'on-failure': return 'retain-on-failure'
    case 'always': return 'on'
  }
}

function mapTraceMode(mode: ResolvedArtifactPolicy['traceMode']): string {
  switch (mode) {
    case 'off': return 'off'
    case 'on-failure': return 'retain-on-failure'
    case 'always': return 'on'
  }
}

export function buildEnvVars(request: RunRequest): Record<string, string> {
  const env: Record<string, string> = {}

  if (request.baseURLOverride) {
    env['BASE_URL'] = request.baseURLOverride
  }

  if (request.extraEnv) {
    Object.assign(env, request.extraEnv)
  }

  return env
}
