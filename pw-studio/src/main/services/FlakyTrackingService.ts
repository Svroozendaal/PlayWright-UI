import type Database from 'better-sqlite3'
import type { FlakyTestRecord, TestHistoryEntry } from '../../shared/types/ipc'

export class FlakyTrackingService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  updateFromRun(projectId: string, runId: string): void {
    const results = this.db
      .prepare('SELECT testTitle, status, retryCount FROM run_test_results WHERE runId = ?')
      .all(runId) as { testTitle: string; status: string; retryCount: number }[]

    if (results.length === 0) return

    const now = new Date().toISOString()

    const upsert = this.db.prepare(`
      INSERT INTO test_flakiness (testTitle, projectId, totalRuns, totalPasses, totalFailures, flakyCount, lastSeenAt)
      VALUES (?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(projectId, testTitle) DO UPDATE SET
        totalRuns = totalRuns + 1,
        totalPasses = totalPasses + ?,
        totalFailures = totalFailures + ?,
        flakyCount = flakyCount + ?,
        lastSeenAt = ?
    `)

    this.db.transaction(() => {
      for (const r of results) {
        const passed = r.status === 'passed' ? 1 : 0
        const failed = r.status === 'failed' || r.status === 'timedOut' ? 1 : 0
        // A test is flaky if it passed on retry (retryCount > 0 and passed)
        const isFlaky = (r.retryCount > 0 && r.status === 'passed') ? 1 : 0

        upsert.run(
          r.testTitle, projectId,
          passed, failed, isFlaky, now,
          passed, failed, isFlaky, now
        )
      }
    })()

    // Mark tests as flaky if they have both passes and failures historically
    this.db.prepare(`
      UPDATE test_flakiness
      SET flakyCount = CASE
        WHEN totalPasses > 0 AND totalFailures > 0 THEN
          CASE WHEN flakyCount = 0 THEN 1 ELSE flakyCount END
        ELSE flakyCount
      END
      WHERE projectId = ?
    `).run(projectId)
  }

  getFlakyTests(projectId: string): FlakyTestRecord[] {
    return this.db
      .prepare(`
        SELECT testTitle, projectId, totalRuns, totalPasses, totalFailures, flakyCount, lastSeenAt
        FROM test_flakiness
        WHERE projectId = ? AND flakyCount > 0
        ORDER BY flakyCount DESC
      `)
      .all(projectId) as FlakyTestRecord[]
  }

  getTestHistory(projectId: string, testTitle: string): TestHistoryEntry[] {
    return this.db
      .prepare(`
        SELECT r.id AS runId, r.startedAt, rtr.status, rtr.duration, rtr.retryCount
        FROM run_test_results rtr
        JOIN runs r ON r.id = rtr.runId
        WHERE r.projectId = ? AND rtr.testTitle = ?
        ORDER BY r.startedAt DESC
        LIMIT 50
      `)
      .all(projectId, testTitle) as TestHistoryEntry[]
  }
}
