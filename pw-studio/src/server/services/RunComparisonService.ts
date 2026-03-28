import type Database from 'better-sqlite3'
import type { RunRecord, RunComparison, ComparedTest } from '../../shared/types/ipc'

export class RunComparisonService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  compare(runIdA: string, runIdB: string): RunComparison | null {
    const runA = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runIdA) as RunRecord | undefined
    const runB = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runIdB) as RunRecord | undefined

    if (!runA || !runB) return null

    type ResultRow = { testTitle: string; status: string; duration: number | null }

    const resultsA = this.db
      .prepare('SELECT testTitle, status, duration FROM run_test_results WHERE runId = ?')
      .all(runIdA) as ResultRow[]

    const resultsB = this.db
      .prepare('SELECT testTitle, status, duration FROM run_test_results WHERE runId = ?')
      .all(runIdB) as ResultRow[]

    const mapA = new Map<string, ResultRow>()
    for (const r of resultsA) mapA.set(r.testTitle, r)

    const mapB = new Map<string, ResultRow>()
    for (const r of resultsB) mapB.set(r.testTitle, r)

    const allTitles = new Set([...mapA.keys(), ...mapB.keys()])
    const tests: ComparedTest[] = []

    for (const title of allTitles) {
      const a = mapA.get(title)
      const b = mapB.get(title)

      let category: ComparedTest['category']

      if (!a) {
        category = 'new'
      } else if (!b) {
        category = 'removed'
      } else if (a.status === b.status) {
        category = 'same'
      } else if (a.status !== 'passed' && b.status === 'passed') {
        category = 'fixed'
      } else if (a.status === 'passed' && b.status !== 'passed') {
        category = 'regressed'
      } else {
        category = 'changed'
      }

      tests.push({
        testTitle: title,
        statusA: a?.status ?? null,
        statusB: b?.status ?? null,
        durationA: a?.duration ?? null,
        durationB: b?.duration ?? null,
        category,
      })
    }

    // Sort: regressed first, then fixed, new, changed, removed, same
    const order: Record<string, number> = { regressed: 0, fixed: 1, new: 2, changed: 3, removed: 4, same: 5 }
    tests.sort((x, y) => (order[x.category] ?? 5) - (order[y.category] ?? 5))

    return { runA, runB, tests }
  }
}
