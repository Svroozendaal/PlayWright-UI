import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RunRecord, RunStatus } from '../../../shared/types/ipc'

function statusBadge(status: RunStatus): { label: string; className: string } {
  switch (status) {
    case 'passed': return { label: 'Passed', className: 'badge-pass' }
    case 'failed': return { label: 'Failed', className: 'badge-fail' }
    case 'running': return { label: 'Running', className: 'badge-running' }
    case 'queued': return { label: 'Queued', className: 'badge-running' }
    case 'cancelled': return { label: 'Cancelled', className: 'badge-cancelled' }
    case 'config-error': return { label: 'Config Error', className: 'badge-fail' }
  }
}

export function RunsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [compareMode, setCompareMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchRuns = useCallback(async () => {
    if (!projectId) return
    const result = await window.api.invoke<RunRecord[]>(IPC.RUNS_LIST, { projectId })
    const envelope = result as IpcEnvelope<RunRecord[]>
    if (envelope.payload) {
      setRuns(envelope.payload)
    }
  }, [projectId])

  useEffect(() => {
    fetchRuns()
  }, [fetchRuns])

  useEffect(() => {
    const handler = (): void => { fetchRuns() }
    window.api.on(IPC.RUNS_STATUS_CHANGED, handler)
    return () => { window.api.off(IPC.RUNS_STATUS_CHANGED, handler) }
  }, [fetchRuns])

  const filtered = filter === 'all' ? runs : runs.filter((r) => r.status === filter)

  const toggleSelect = (runId: string): void => {
    const next = new Set(selected)
    if (next.has(runId)) {
      next.delete(runId)
    } else if (next.size < 2) {
      next.add(runId)
    }
    setSelected(next)
  }

  const handleCompare = (): void => {
    const ids = Array.from(selected)
    if (ids.length === 2) {
      navigate(`/project/${projectId}/runs/compare?a=${ids[0]}&b=${ids[1]}`)
    }
  }

  const exitCompareMode = (): void => {
    setCompareMode(false)
    setSelected(new Set())
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Runs</h2>
        <div className="page-header-actions">
          {compareMode ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={handleCompare} disabled={selected.size !== 2}>
                Compare ({selected.size}/2)
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exitCompareMode}>Cancel</button>
            </>
          ) : (
            runs.length >= 2 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setCompareMode(true)}>Compare Runs</button>
            )
          )}
        </div>
      </div>

      <div className="actions" style={{ marginBottom: 16 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="form-select">
          <option value="all">All</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="config-error">Config Error</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <h3>No runs yet</h3>
          <p>Run tests from the Explorer or Dashboard to see results here.</p>
        </div>
      ) : (
        <div className="run-list">
          {filtered.map((run) => {
            const badge = statusBadge(run.status)
            const duration = run.finishedAt && run.startedAt
              ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
              : null
            const isSelected = selected.has(run.id)

            return (
              <div
                key={run.id}
                className={`run-card ${isSelected ? 'run-card-selected' : ''}`}
                onClick={() => {
                  if (compareMode) {
                    toggleSelect(run.id)
                  } else {
                    navigate(`/project/${projectId}/runs/${run.id}`)
                  }
                }}
              >
                {compareMode && (
                  <input type="checkbox" checked={isSelected} readOnly style={{ marginRight: 8, width: 16, height: 16 }} />
                )}
                <div className="run-card-info">
                  <span className={`run-badge ${badge.className}`}>{badge.label}</span>
                  <span className="run-target">{run.targetPath ?? run.target ?? 'All tests'}</span>
                </div>
                <div className="run-card-meta">
                  {run.environment && <span className="run-env-tag">{run.environment}</span>}
                  <span>{new Date(run.startedAt).toLocaleString()}</span>
                  {duration !== null && <span>{duration}s</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
