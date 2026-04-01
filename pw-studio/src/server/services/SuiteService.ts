import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { Suite, SuiteEntry, SuiteFile } from '../../shared/types/ipc'

const SUITES_DIR = '.pw-studio'
const SUITES_FILE = 'suites.json'

/**
 * Resolve the path to suites.json within a project root.
 *
 * Params:
 * rootPath - Absolute path to the project root directory.
 *
 * Returns:
 * Absolute path to the suites.json file.
 */
function suitesFilePath(rootPath: string): string {
  return path.join(rootPath, SUITES_DIR, SUITES_FILE)
}

/**
 * Load the suites file from disk, returning an empty suite list when the file does not exist.
 *
 * Params:
 * rootPath - Absolute path to the project root directory.
 *
 * Returns:
 * Parsed SuiteFile contents.
 */
function loadSuiteFile(rootPath: string): SuiteFile {
  const filePath = suitesFilePath(rootPath)
  if (!fs.existsSync(filePath)) {
    return { suites: [] }
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as SuiteFile
  } catch {
    return { suites: [] }
  }
}

/**
 * Persist the suites file to disk, creating the .pw-studio directory if needed.
 *
 * Params:
 * rootPath - Absolute path to the project root directory.
 * data - SuiteFile content to write.
 */
function saveSuiteFile(rootPath: string, data: SuiteFile): void {
  const dir = path.join(rootPath, SUITES_DIR)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(suitesFilePath(rootPath), JSON.stringify(data, null, 2), 'utf-8')
}

export class SuiteService {
  /**
   * List all suites for a project.
   *
   * Params:
   * rootPath - Absolute path to the project root directory.
   *
   * Returns:
   * Array of Suite records.
   */
  listSuites(rootPath: string): Suite[] {
    return loadSuiteFile(rootPath).suites
  }

  /**
   * Create a new suite with the given name.
   *
   * Params:
   * rootPath - Absolute path to the project root directory.
   * name - Display name for the new suite.
   *
   * Returns:
   * The newly created Suite.
   */
  createSuite(rootPath: string, name: string): Suite {
    const data = loadSuiteFile(rootPath)
    const suite: Suite = {
      id: crypto.randomUUID(),
      name,
      entries: [],
    }
    data.suites.push(suite)
    saveSuiteFile(rootPath, data)
    return suite
  }

  /**
   * Update an existing suite's name and/or entries.
   *
   * Params:
   * rootPath - Absolute path to the project root directory.
   * suiteId - Identifier of the suite to update.
   * patch - Partial suite fields to apply (name, entries).
   *
   * Returns:
   * The updated Suite, or null when not found.
   */
  updateSuite(
    rootPath: string,
    suiteId: string,
    patch: { name?: string; entries?: SuiteEntry[] }
  ): Suite | null {
    const data = loadSuiteFile(rootPath)
    const idx = data.suites.findIndex((s) => s.id === suiteId)
    if (idx === -1) return null

    const current = data.suites[idx]
    if (!current) return null

    const updated: Suite = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.entries !== undefined ? { entries: patch.entries } : {}),
    }
    data.suites[idx] = updated
    saveSuiteFile(rootPath, data)
    return updated
  }

  /**
   * Delete a suite by id.
   *
   * Params:
   * rootPath - Absolute path to the project root directory.
   * suiteId - Identifier of the suite to delete.
   *
   * Returns:
   * True when deleted, false when not found.
   */
  deleteSuite(rootPath: string, suiteId: string): boolean {
    const data = loadSuiteFile(rootPath)
    const before = data.suites.length
    data.suites = data.suites.filter((s) => s.id !== suiteId)
    if (data.suites.length === before) return false
    saveSuiteFile(rootPath, data)
    return true
  }

  /**
   * Retrieve a single suite by id.
   *
   * Params:
   * rootPath - Absolute path to the project root directory.
   * suiteId - Identifier of the suite.
   *
   * Returns:
   * The Suite, or null when not found.
   */
  getSuite(rootPath: string, suiteId: string): Suite | null {
    return loadSuiteFile(rootPath).suites.find((s) => s.id === suiteId) ?? null
  }
}
