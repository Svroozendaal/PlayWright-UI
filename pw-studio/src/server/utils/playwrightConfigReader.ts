import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

export type PlaywrightConfigSummary = {
  testDir: string
  projects: string[]
  outputDir: string
  readMethod: 'config' | 'regex' | 'fallback'
}

export function readPlaywrightConfig(rootPath: string): PlaywrightConfigSummary {
  // Strategy 1: Dynamic import via Node subprocess (works for .js/.mjs configs)
  const dynamic = tryDynamicImport(rootPath)
  if (dynamic) return dynamic

  // Strategy 2: Regex extraction from the config file (works for .ts configs)
  const regex = tryRegexParse(rootPath)
  if (regex) return regex

  // Strategy 3: Fallback defaults
  return {
    testDir: path.join(rootPath, 'tests'),
    projects: [],
    outputDir: path.join(rootPath, 'test-results'),
    readMethod: 'fallback',
  }
}

function tryDynamicImport(rootPath: string): PlaywrightConfigSummary | null {
  try {
    const extractorScript = buildExtractorScript()
    const output = execFileSync(process.execPath, ['--input-type=module'], {
      input: extractorScript,
      cwd: rootPath,
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, PWSTUDIO_EXTRACT: '1' },
    })
    const parsed = JSON.parse(output) as {
      testDir: string
      projects: string[]
      outputDir: string
    }
    return { ...parsed, readMethod: 'config' }
  } catch {
    return null
  }
}

function tryRegexParse(rootPath: string): PlaywrightConfigSummary | null {
  const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']

  for (const f of configFiles) {
    const filePath = path.join(rootPath, f)
    if (!fs.existsSync(filePath)) continue

    try {
      const content = fs.readFileSync(filePath, 'utf8')

      // Extract testDir
      const testDirMatch = content.match(/testDir\s*:\s*['"`](.+?)['"`]/)
      const testDirValue = testDirMatch?.[1]
      const testDir = testDirValue
        ? path.resolve(rootPath, testDirValue)
        : path.join(rootPath, 'tests')

      // Extract outputDir
      const outputDirMatch = content.match(/outputDir\s*:\s*['"`](.+?)['"`]/)
      const outputDirValue = outputDirMatch?.[1]
      const outputDir = outputDirValue
        ? path.resolve(rootPath, outputDirValue)
        : path.join(rootPath, 'test-results')

      // Extract project names
      const projects: string[] = []
      const projectNameRegex = /name\s*:\s*['"`](.+?)['"`]/g
      let match: RegExpExecArray | null
      while ((match = projectNameRegex.exec(content)) !== null) {
        const name = match[1]
        if (name) projects.push(name)
      }

      return { testDir, projects, outputDir, readMethod: 'regex' }
    } catch {
      continue
    }
  }

  return null
}

function buildExtractorScript(): string {
  return `
import { pathToFileURL } from 'url';
import path from 'path';

const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];
let config = null;
for (const f of configFiles) {
  try {
    const mod = await import(pathToFileURL(path.resolve(f)).href);
    config = mod.default ?? mod;
    break;
  } catch {}
}

const testDir = path.resolve(config?.testDir ?? 'tests');
const outputDir = path.resolve(config?.outputDir ?? 'test-results');
const projects = (config?.projects ?? []).map(p => p.name).filter(Boolean);

process.stdout.write(JSON.stringify({ testDir, projects, outputDir }));
`
}
