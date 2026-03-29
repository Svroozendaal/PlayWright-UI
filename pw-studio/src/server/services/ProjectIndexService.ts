import fs from 'fs'
import path from 'path'
import type { ExplorerNode } from '../../shared/types/ipc'
import type { PlaywrightConfigService } from './PlaywrightConfigService'
import { formatParseDiagnostics, parseTestSource } from '../utils/testEditorAst'

export type ParseWarning = {
  filePath: string
  message: string
}

const TEST_FILE_PATTERN = /\.(spec|test)\.(ts|js|mjs)$/

export class ProjectIndexService {
  private trees = new Map<string, ExplorerNode[]>()
  private warnings = new Map<string, ParseWarning[]>()
  private configService: PlaywrightConfigService

  constructor(configService: PlaywrightConfigService) {
    this.configService = configService
  }

  async buildIndex(projectId: string, rootPath: string): Promise<ExplorerNode[]> {
    const configSummary = this.configService.get(projectId, rootPath)
    const testDir = configSummary.testDir

    const warnings: ParseWarning[] = []

    if (!fs.existsSync(testDir)) {
      this.trees.set(projectId, [])
      this.warnings.set(projectId, [])
      return []
    }

    const tree = buildTree(testDir, testDir, warnings)
    this.trees.set(projectId, tree)
    this.warnings.set(projectId, warnings)
    return tree
  }

  invalidate(projectId: string): void {
    this.trees.delete(projectId)
    this.warnings.delete(projectId)
  }

  getTree(projectId: string): ExplorerNode[] | null {
    return this.trees.get(projectId) ?? null
  }

  getParseWarnings(projectId: string): ParseWarning[] {
    return this.warnings.get(projectId) ?? []
  }
}

function buildTree(
  dirPath: string,
  rootTestDir: string,
  warnings: ParseWarning[]
): ExplorerNode[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true })
  } catch {
    return []
  }

  const nodes: ExplorerNode[] = []

  // Sort: directories first, then files, alphabetical
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1
    if (!a.isDirectory() && b.isDirectory()) return 1
    return a.name.localeCompare(b.name)
  })

  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.relative(rootTestDir, fullPath)
    const id = relativePath.replace(/\\/g, '/')

    if (entry.isDirectory()) {
      // Skip hidden directories and node_modules
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue

      const children = buildTree(fullPath, rootTestDir, warnings)
      nodes.push({
        id,
        name: entry.name,
        type: 'directory',
        path: fullPath,
        children,
      })
    } else if (entry.isFile()) {
      const isTestFile = TEST_FILE_PATTERN.test(entry.name)

      if (isTestFile) {
        const { children, parseState, parseWarning } = extractTestCases(fullPath, id, warnings)
        nodes.push({
          id,
          name: entry.name,
          type: 'testFile',
          path: fullPath,
          children,
          parseState,
          parseWarning,
        })
      } else {
        // Only show .ts, .js, .mjs files in the tree
        if (/\.(ts|js|mjs)$/.test(entry.name)) {
          nodes.push({
            id,
            name: entry.name,
            type: 'file',
            path: fullPath,
          })
        }
      }
    }
  }

  return nodes
}

function extractTestCases(
  filePath: string,
  parentId: string,
  warnings: ParseWarning[]
): {
  children: ExplorerNode[]
  parseState: 'ok' | 'warning'
  parseWarning?: string
} {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = parseTestSource(content, filePath)
    const children: ExplorerNode[] = parsed.testCases.map((testCase) => ({
      id: `${parentId}::${testCase.ordinal}`,
      name: testCase.title,
      type: 'testCase',
      path: filePath,
      testTitle: testCase.title,
      testCaseRef: testCase.testCaseRef,
    }))

    const diagnostics = formatParseDiagnostics(parsed)
    if (diagnostics.length > 0) {
      const message = diagnostics.join('; ')
      warnings.push({ filePath, message })
      return {
        children,
        parseState: 'warning',
        parseWarning: message,
      }
    }

    return { children, parseState: 'ok' }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    warnings.push({ filePath, message })
    return {
      children: [],
      parseState: 'warning',
      parseWarning: message,
    }
  }
}
