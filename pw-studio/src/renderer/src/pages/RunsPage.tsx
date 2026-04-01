import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RunRecord, RunStatus } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'

/**
 * Resolves the shared badge label and style for a run status.
 *
 * @param status The run status from persisted history.
 * @returns The label and CSS class pair used by the runs table.
 */
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

/**
 * Builds a compact duration label for a completed run.
 *
 * @param run The run record to inspect.
 * @returns A human-readable duration or placeholder.
 */
function formatDuration(run: RunRecord): string {
  if (!run.finishedAt || !run.startedAt) {
    return '--'
  }
  const seconds = Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
  const mins = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return mins > 0 ? `${mins}m ${remaining}s` : `${remaining}s`
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
    const result = await api.invoke<RunRecord[]>(IPC.RUNS_LIST, { projectId })
    const envelope = result as IpcEnvelope<RunRecord[]>
    if (envelope.payload) {
      setRuns(envelope.payload)
    }
  }, [projectId])

  useEffect(() => {
    void fetchRuns()
  }, [fetchRuns])

  useSocketEvent(IPC.RUNS_STATUS_CHANGED, () => {
    void fetchRuns()
  })

  const filtered = filter === 'all' ? runs : runs.filter((run) => run.status === filter)

  /**
   * Toggles compare-mode selection while capping the selection at two runs.
   *
   * @param runId The run identifier to add or remove.
   * @returns Nothing.
   */
  const toggleSelect = (runId: string): void => {
    const next = new Set(selected)
    if (next.has(runId)) {
      next.delete(runId)
    } else if (next.size < 2) {
      next.add(runId)
    }
    setSelected(next)
  }

  /**
   * Opens the compare screen when exactly two runs are selected.
   *
   * @returns Nothing.
   */
  const handleCompare = (): void => {
    const ids = Array.from(selected)
    if (ids.length === 2) {
      navigate(`/project/${projectId}/runs/compare?a=${ids[0]}&b=${ids[1]}`)
    }
  }

  /**
   * Leaves compare mode and clears any pending selection.
   *
   * @returns Nothing.
   */
  const exitCompareMode = (): void => {
    setCompareMode(false)
    setSelected(new Set())
  }

  return (
    <div className="page-inner carbon-page">
      <section className="carbon-hero carbon-hero-compact">
        <div className="carbon-hero-copy">
          <span className="carbon-kicker">Execution / Run Registry</span>
          <h2>Runs</h2>
          <p>Inspect history, isolate failures, and compare the last two relevant executions.</p>
        </div>
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
      </section>

      <section className="carbon-toolbar">
        <select value={filter} onChange={(event) => setFilter(event.target.value)} className="form-select">
          <option value="all">All</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
          <option value="config-error">Config Error</option>
        </select>
        <span className="carbon-toolbar-meta">{filtered.length} visible</span>
      </section>

      {filtered.length === 0 ? (
        <div className="empty-state carbon-panel">
          <h3>No runs yet</h3>
          <p>Run tests from the dashboard or explorer to populate the registry.</p>
        </div>
      ) : (
        <section className="carbon-panel carbon-table-panel">
          <div className="carbon-table-header">
            <span>Run ID</span>
            <span>Status</span>
            <span>Target</span>
            <span>Environment</span>
            <span>Started</span>
            <span>Duration</span>
          </div>
          <div className="run-list carbon-run-list">
            {filtered.map((run) => {
              const badge = statusBadge(run.status)
              const isSelected = selected.has(run.id)

              return (
                <button
                  key={run.id}
                  type="button"
                  className={`run-card carbon-run-row ${isSelected ? 'run-card-selected' : ''}`}
                  onClick={() => {
                    if (compareMode) {
                      toggleSelect(run.id)
                    } else {
                      navigate(`/project/${projectId}/runs/${run.id}`)
                    }
                  }}
                >
                  <span className="carbon-run-id">
                    {compareMode && (
                      <input type="checkbox" checked={isSelected} readOnly />
                    )}
                    {run.id.slice(0, 8)}
                  </span>
                  <span className={`run-badge ${badge.className}`}>{badge.label}</span>
                  <span className="run-target">{run.targetPath ?? run.target ?? 'All tests'}</span>
                  <span className="run-env-tag">{run.environment ?? '--'}</span>
                  <span className="carbon-run-date">{new Date(run.startedAt).toLocaleString()}</span>
                  <span className="carbon-run-duration">{formatDuration(run)}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
