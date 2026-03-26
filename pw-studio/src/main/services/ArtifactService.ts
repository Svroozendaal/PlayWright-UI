import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { shell } from 'electron'
import type Database from 'better-sqlite3'
import type { ResolvedArtifactPolicy } from './CommandBuilder'

export type FileArtifactPolicy = {
  id: string
  projectId: string
  filePath: string
  screenshotMode: 'off' | 'on-failure' | 'always'
  traceMode: 'off' | 'on-failure' | 'always'
  videoMode: 'off' | 'on-failure' | 'always'
}

const DEFAULT_POLICY: ResolvedArtifactPolicy = {
  screenshotMode: 'on-failure',
  traceMode: 'on-failure',
  videoMode: 'off',
}

export class ArtifactService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  resolvePolicy(projectId: string, filePath: string): ResolvedArtifactPolicy {
    // 1. Look for file-specific policy
    const filePolicy = this.db
      .prepare('SELECT * FROM file_artifact_policies WHERE projectId = ? AND filePath = ?')
      .get(projectId, filePath) as FileArtifactPolicy | undefined

    if (filePolicy) {
      return {
        screenshotMode: filePolicy.screenshotMode,
        traceMode: filePolicy.traceMode,
        videoMode: filePolicy.videoMode,
      }
    }

    // 2. Look for project default (filePath = '*')
    const projectDefault = this.db
      .prepare("SELECT * FROM file_artifact_policies WHERE projectId = ? AND filePath = '*'")
      .get(projectId) as FileArtifactPolicy | undefined

    if (projectDefault) {
      return {
        screenshotMode: projectDefault.screenshotMode,
        traceMode: projectDefault.traceMode,
        videoMode: projectDefault.videoMode,
      }
    }

    // 3. Hardcoded fallback
    return { ...DEFAULT_POLICY }
  }

  getFilePolicy(projectId: string, filePath: string): FileArtifactPolicy | null {
    const row = this.db
      .prepare('SELECT * FROM file_artifact_policies WHERE projectId = ? AND filePath = ?')
      .get(projectId, filePath) as FileArtifactPolicy | undefined
    return row ?? null
  }

  setFilePolicy(
    projectId: string,
    filePath: string,
    policy: { screenshotMode: string; traceMode: string; videoMode: string }
  ): FileArtifactPolicy {
    const existing = this.getFilePolicy(projectId, filePath)

    if (existing) {
      this.db
        .prepare(
          `UPDATE file_artifact_policies SET screenshotMode = ?, traceMode = ?, videoMode = ?
           WHERE projectId = ? AND filePath = ?`
        )
        .run(policy.screenshotMode, policy.traceMode, policy.videoMode, projectId, filePath)
      return { ...existing, ...policy } as FileArtifactPolicy
    }

    const id = crypto.randomUUID()
    this.db
      .prepare(
        `INSERT INTO file_artifact_policies (id, projectId, filePath, screenshotMode, traceMode, videoMode)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, projectId, filePath, policy.screenshotMode, policy.traceMode, policy.videoMode)

    return {
      id,
      projectId,
      filePath,
      screenshotMode: policy.screenshotMode as FileArtifactPolicy['screenshotMode'],
      traceMode: policy.traceMode as FileArtifactPolicy['traceMode'],
      videoMode: policy.videoMode as FileArtifactPolicy['videoMode'],
    }
  }

  deleteFilePolicy(projectId: string, filePath: string): void {
    this.db
      .prepare('DELETE FROM file_artifact_policies WHERE projectId = ? AND filePath = ?')
      .run(projectId, filePath)
  }

  collectArtifactsForRun(runId: string, runDir: string): void {
    const reportPath = path.join(runDir, 'playwright-report', 'index.html')
    const logPath = path.join(runDir, 'log.txt')
    const resultsPath = path.join(runDir, 'results.json')

    const updates: string[] = []
    const params: (string | null)[] = []

    if (fs.existsSync(reportPath)) {
      updates.push('reportPath = ?')
      params.push(reportPath)
    }
    if (fs.existsSync(logPath)) {
      updates.push('logPath = ?')
      params.push(logPath)
    }
    if (fs.existsSync(resultsPath)) {
      updates.push('resultsPath = ?')
      params.push(resultsPath)
    }

    if (updates.length > 0) {
      params.push(runId)
      this.db
        .prepare(`UPDATE runs SET ${updates.join(', ')} WHERE id = ?`)
        .run(...params)
    }
  }

  openArtifact(filePath: string): void {
    shell.openPath(filePath)
  }

  openReport(reportPath: string): void {
    shell.openExternal(`file://${reportPath}`)
  }
}
