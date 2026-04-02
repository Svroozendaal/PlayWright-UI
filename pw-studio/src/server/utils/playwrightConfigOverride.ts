import fs from 'fs'
import path from 'path'

const CONFIG_FILES = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs']

function findPlaywrightConfigFile(rootPath: string): string | null {
  for (const file of CONFIG_FILES) {
    const candidate = path.join(rootPath, file)
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

function toImportSpecifier(fromDir: string, targetPath: string): string {
  const relativePath = path.relative(fromDir, targetPath).split(path.sep).join('/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

export function createRunConfigOverride(
  rootPath: string,
  runId: string,
  runDir: string,
  reportDir: string,
  options?: { testDir?: string }
): string | null {
  const configPath = findPlaywrightConfigFile(rootPath)
  if (!configPath) {
    return null
  }

  const overrideDir = rootPath
  const overridePath = path.join(overrideDir, `.pw-studio.${runId}.config.ts`)
  const importPath = toImportSpecifier(overrideDir, configPath)
  const testDirLine = options?.testDir ? `  testDir: ${JSON.stringify(options.testDir)},\n` : ''

  fs.writeFileSync(
    overridePath,
    `import originalConfig from ${JSON.stringify(importPath)}

const baseConfig = originalConfig ?? {}
const actionTimeoutRaw = process.env.PW_STUDIO_ACTION_TIMEOUT
const actionTimeout = actionTimeoutRaw ? parseInt(actionTimeoutRaw, 10) : undefined

export default {
  ...baseConfig,
  outputDir: ${JSON.stringify(runDir)},
${testDirLine}  reporter: [
    ['line'],
    ['json', { outputFile: ${JSON.stringify(path.join(runDir, 'results.json'))} }],
    ['html', { open: 'never', outputFolder: ${JSON.stringify(reportDir)} }],
  ],
  use: {
    ...(baseConfig.use ?? {}),
    baseURL: process.env.BASE_URL ?? baseConfig.use?.baseURL,
    ...(actionTimeout && !isNaN(actionTimeout) ? { actionTimeout } : {}),
  },
}
`
  )

  return overridePath
}
