import type Database from 'better-sqlite3'
import type { DashboardStats, RunRecord, ExplorerNode } from '../../shared/types/ipc'
import type { ProjectIndexService } from './ProjectIndexService'
import type { FlakyTrackingService } from './FlakyTrackingService'

export class DashboardService {
  private db: Database.Database
  private projectIndex: ProjectIndexService
  private flakyTracking: FlakyTrackingService

  constructor(db: Database.Database, projectIndex: ProjectIndexService, flakyTracking: FlakyTrackingService) {
    this.db = db
    this.projectIndex = projectIndex
    this.flakyTracking = flakyTracking
  }

  getStats(projectId: string): DashboardStats {
    // Count files and tests from the explorer tree
    const tree = this.projectIndex.getTree(projectId)
    let totalFiles = 0
    let totalTests = 0
    if (tree) {
      this.countNodes(tree, (node) => {
        if (node.type === 'testFile') totalFiles++
        if (node.type === 'testCase') totalTests++
      })
    }

    // Recent runs (last 5)
    const recentRuns = this.db
      .prepare(
        `SELECT * FROM runs WHERE projectId = ? ORDER BY startedAt DESC LIMIT 5`
      )
      .all(projectId) as RunRecord[]

    // Pass rate from the most recent completed run
    let passRate: number | null = null
    const lastCompletedRun = this.db
      .prepare(
        `SELECT id FROM runs WHERE projectId = ? AND status IN ('passed', 'failed') ORDER BY startedAt DESC LIMIT 1`
      )
      .get(projectId) as { id: string } | undefined

    if (lastCompletedRun) {
      const counts = this.db
        .prepare(
          `SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed
          FROM run_test_results WHERE runId = ?`
        )
        .get(lastCompletedRun.id) as { total: number; passed: number }
      if (counts.total > 0) {
        passRate = Math.round((counts.passed / counts.total) * 100)
      }
    }

    // Flaky count
    const flakyTests = this.flakyTracking.getFlakyTests(projectId)
    const flakyCount = flakyTests.length

    return { totalFiles, totalTests, passRate, flakyCount, recentRuns }
  }

  private countNodes(nodes: ExplorerNode[], visitor: (node: ExplorerNode) => void): void {
    for (const node of nodes) {
      visitor(node)
      if (node.children) {
        this.countNodes(node.children, visitor)
      }
    }
  }
}
