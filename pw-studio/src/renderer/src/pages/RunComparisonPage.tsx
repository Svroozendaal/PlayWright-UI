import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RunComparison, ComparedTest } from '../../../shared/types/ipc'
import { api } from '../api/client'

type CategoryFilter = 'all' | ComparedTest['category']

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  regressed: 'Regressed',
  fixed: 'Fixed',
  new: 'New',
  removed: 'Removed',
  changed: 'Changed',
  same: 'Unchanged',
}

const CATEGORY_COLORS: Record<string, string> = {
  regressed: '#ef4444',
  fixed: '#22c55e',
  new: '#3b82f6',
  removed: '#94a3b8',
  changed: '#f59e0b',
  same: '#e2e8f0',
}

export function RunComparisonPage(): JSX.Element {
  const [searchParams] = useSearchParams()
  const runIdA = searchParams.get('a') ?? ''
  const runIdB = searchParams.get('b') ?? ''
  const [comparison, setComparison] = useState<RunComparison | null>(null)
  const [filter, setFilter] = useState<CategoryFilter>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!runIdA || !runIdB) {
      setError('Two run IDs are required for comparison')
      return
    }
    const fetch = async (): Promise<void> => {
      const result = await api.invoke<RunComparison>(IPC.RUNS_COMPARE, { runIdA, runIdB })
      const envelope = result as IpcEnvelope<RunComparison>
      if (envelope.error) {
        setError(envelope.error.message)
      } else if (envelope.payload) {
        setComparison(envelope.payload)
      }
    }
    void fetch()
  }, [runIdA, runIdB])

  const filtered = comparison
    ? filter === 'all'
      ? comparison.tests
      : comparison.tests.filter((t) => t.category === filter)
    : []

  const categoryCounts = comparison
    ? comparison.tests.reduce<Record<string, number>>((acc, t) => {
        acc[t.category] = (acc[t.category] ?? 0) + 1
        return acc
      }, {})
    : {}

  const formatDate = (d: string): string => new Date(d).toLocaleString()

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Compare Runs</h2>
      </div>
        {error && <div className="error-message">{error}</div>}

        {comparison && (
          <>
            <div className="compare-header">
              <div className="compare-run-card">
                <span className="compare-label">Run A</span>
                <span className="compare-date">{formatDate(comparison.runA.startedAt)}</span>
                <span className={`run-badge ${comparison.runA.status === 'passed' ? 'badge-pass' : 'badge-fail'}`}>
                  {comparison.runA.status}
                </span>
              </div>
              <div className="compare-vs">vs</div>
              <div className="compare-run-card">
                <span className="compare-label">Run B</span>
                <span className="compare-date">{formatDate(comparison.runB.startedAt)}</span>
                <span className={`run-badge ${comparison.runB.status === 'passed' ? 'badge-pass' : 'badge-fail'}`}>
                  {comparison.runB.status}
                </span>
              </div>
            </div>

            <div className="compare-filters">
              {(['all', 'regressed', 'fixed', 'new', 'removed', 'changed', 'same'] as CategoryFilter[]).map((cat) => {
                const count = cat === 'all' ? comparison.tests.length : (categoryCounts[cat] ?? 0)
                return (
                  <button
                    key={cat}
                    className={`compare-filter-btn ${filter === cat ? 'active' : ''}`}
                    onClick={() => setFilter(cat)}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                )
              })}
            </div>

            <div className="compare-table">
              <div className="compare-table-header">
                <span className="compare-col-test">Test</span>
                <span className="compare-col-status">Run A</span>
                <span className="compare-col-status">Run B</span>
                <span className="compare-col-category">Delta</span>
              </div>
              {filtered.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <p>No tests match this filter</p>
                </div>
              ) : (
                filtered.map((t, i) => (
                  <div key={i} className="compare-table-row">
                    <span className="compare-col-test">{t.testTitle}</span>
                    <span className="compare-col-status">
                      <span className={`run-badge ${t.statusA === 'passed' ? 'badge-pass' : t.statusA === 'failed' ? 'badge-fail' : 'badge-cancelled'}`}>
                        {t.statusA ?? '-'}
                      </span>
                    </span>
                    <span className="compare-col-status">
                      <span className={`run-badge ${t.statusB === 'passed' ? 'badge-pass' : t.statusB === 'failed' ? 'badge-fail' : 'badge-cancelled'}`}>
                        {t.statusB ?? '-'}
                      </span>
                    </span>
                    <span className="compare-col-category">
                      <span
                        className="compare-category-badge"
                        style={{ background: CATEGORY_COLORS[t.category] ?? '#e2e8f0' }}
                      >
                        {t.category}
                      </span>
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
    </div>
  )
}
