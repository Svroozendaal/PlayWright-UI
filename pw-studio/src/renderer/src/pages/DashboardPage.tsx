import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, DashboardStats, RunRecord, RunRequest } from '../../../shared/types/ipc'
import { useProject } from '../components/ProjectLayout'

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'passed': return 'badge-pass'
    case 'failed': case 'config-error': return 'badge-fail'
    case 'running': case 'queued': return 'badge-running'
    default: return 'badge-cancelled'
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function DashboardPage(): JSX.Element {
  const { project, health } = useProject()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async (): Promise<void> => {
      const result = await window.api.invoke<DashboardStats>(IPC.DASHBOARD_GET_STATS, {
        projectId: project.id,
      })
      const envelope = result as IpcEnvelope<DashboardStats>
      if (envelope.payload) {
        setStats(envelope.payload)
      }
      setLoading(false)
    }
    load()

    const handler = (): void => { load() }
    window.api.on(IPC.RUNS_STATUS_CHANGED, handler)
    return () => { window.api.off(IPC.RUNS_STATUS_CHANGED, handler) }
  }, [project.id])

  const handleRunAll = async (): Promise<void> => {
    const request: RunRequest = {
      projectId: project.id,
      browser: project.defaultBrowser
        ? { mode: 'single', projectName: project.defaultBrowser }
        : { mode: 'all' },
      environment: project.activeEnvironment ?? undefined,
      headed: false,
      streamLogs: true,
    }
    const result = await window.api.invoke<string>(IPC.RUNS_START, request)
    const envelope = result as IpcEnvelope<string>
    if (envelope.payload) {
      navigate(`/project/${project.id}/runs/${envelope.payload}`)
    }
  }

  // Health issues (only show when there are problems)
  const healthIssues = health?.items.filter(i => i.status !== 'pass') ?? []

  return (
    <div className="dashboard">
      {/* Quick Actions */}
      <div className="dash-actions">
        <button className="dash-action-card dash-action-run" onClick={handleRunAll}>
          <span className="dash-action-icon">{'\u25B6'}</span>
          <span className="dash-action-label">Run All Tests</span>
          <span className="dash-action-sub">
            {project.defaultBrowser ?? 'all browsers'}
            {project.activeEnvironment ? ` \u00B7 ${project.activeEnvironment}` : ''}
          </span>
        </button>
        <button className="dash-action-card" onClick={() => navigate(`/project/${project.id}/recorder`)}>
          <span className="dash-action-icon">{'\u23FA'}</span>
          <span className="dash-action-label">Record Test</span>
          <span className="dash-action-sub">Open Playwright codegen</span>
        </button>
        <button className="dash-action-card" onClick={() => navigate(`/project/${project.id}/explorer`)}>
          <span className="dash-action-icon">{'\u{1F4C1}'}</span>
          <span className="dash-action-label">Open Explorer</span>
          <span className="dash-action-sub">Browse & edit test files</span>
        </button>
      </div>

      {/* Stats + Recent Runs row */}
      <div className="dash-grid">
        {/* Stats */}
        <div className="dash-stats">
          <h3 className="dash-section-title">Overview</h3>
          {loading ? (
            <div className="dash-stats-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="stat-card">
                  <div className="skeleton skeleton-number" />
                  <div className="skeleton skeleton-label" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="dash-stats-grid">
              <div className="stat-card">
                <span className="stat-number">{stats.totalFiles}</span>
                <span className="stat-label">Test Files</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.totalTests}</span>
                <span className="stat-label">Test Cases</span>
              </div>
              <div className="stat-card">
                <span className={`stat-number ${stats.passRate !== null ? (stats.passRate >= 80 ? 'stat-good' : stats.passRate >= 50 ? 'stat-warn' : 'stat-bad') : ''}`}>
                  {stats.passRate !== null ? `${stats.passRate}%` : '\u2014'}
                </span>
                <span className="stat-label">Pass Rate</span>
              </div>
              <div className="stat-card stat-card-clickable" onClick={() => navigate(`/project/${project.id}/flaky`)}>
                <span className={`stat-number ${stats.flakyCount > 0 ? 'stat-warn' : 'stat-good'}`}>
                  {stats.flakyCount}
                </span>
                <span className="stat-label">Flaky Tests</span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Recent Runs */}
        <div className="dash-recent">
          <div className="dash-section-header">
            <h3 className="dash-section-title">Recent Runs</h3>
            <button className="btn-ghost btn-sm" onClick={() => navigate(`/project/${project.id}/runs`)}>
              View all {'\u2192'}
            </button>
          </div>
          {loading ? (
            <div className="dash-recent-list">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton skeleton-row" />
              ))}
            </div>
          ) : stats && stats.recentRuns.length > 0 ? (
            <div className="dash-recent-list">
              {stats.recentRuns.map((run: RunRecord) => (
                <button
                  key={run.id}
                  className="dash-run-row"
                  onClick={() => navigate(`/project/${project.id}/runs/${run.id}`)}
                >
                  <span className={`run-badge ${statusBadgeClass(run.status)}`}>
                    {run.status}
                  </span>
                  <span className="dash-run-target">
                    {run.target ?? run.targetPath ?? 'All tests'}
                  </span>
                  <span className="dash-run-meta">{timeAgo(run.startedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <p>No runs yet.</p>
              <button className="btn btn-primary btn-sm" onClick={handleRunAll}>
                Run your first test
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Health — compact, only shows issues */}
      {healthIssues.length > 0 ? (
        <div className="dash-health-issues">
          <h3 className="dash-section-title">Health Issues</h3>
          {healthIssues.map((item, i) => (
            <div key={i} className={`dash-health-item dash-health-${item.status}`}>
              <span className="dash-health-icon">
                {item.status === 'error' ? '\u2717' : '\u26A0'}
              </span>
              <div className="dash-health-info">
                <span className="dash-health-name">{item.check}</span>
                <span className="dash-health-msg">{item.message}</span>
                {item.actionHint && (
                  <span className="dash-health-hint">{item.actionHint}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : health ? (
        <div className="dash-health-ok">
          {'\u2713'} All health checks passed
        </div>
      ) : null}

      {/* Project info */}
      <div className="dash-project-info">
        <span>Path: {project.rootPath}</span>
        <span>Source: {project.source}</span>
        <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
      </div>
    </div>
  )
}
