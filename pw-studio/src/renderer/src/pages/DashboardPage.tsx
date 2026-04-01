import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { DashboardStats, IpcEnvelope, RunRecord } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'
import { useProject } from '../components/ProjectLayout'

/**
 * Maps run status values to the shared badge styles.
 *
 * @param status The persisted run status.
 * @returns The CSS badge modifier.
 */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'passed': return 'badge-pass'
    case 'failed':
    case 'config-error':
      return 'badge-fail'
    case 'running':
    case 'queued':
      return 'badge-running'
    default:
      return 'badge-cancelled'
  }
}

/**
 * Formats a compact relative time label for recent activity widgets.
 *
 * @param dateStr The run start timestamp.
 * @returns A short relative label.
 */
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
      const result = await api.invoke<DashboardStats>(IPC.DASHBOARD_GET_STATS, { projectId: project.id })
      const envelope = result as IpcEnvelope<DashboardStats>
      if (envelope.payload) {
        setStats(envelope.payload)
      }
      setLoading(false)
    }
    void load()
  }, [project.id])

  useSocketEvent(IPC.RUNS_STATUS_CHANGED, () => {
    void api.invoke<DashboardStats>(IPC.DASHBOARD_GET_STATS, { projectId: project.id }).then((result) => {
      const envelope = result as IpcEnvelope<DashboardStats>
      if (envelope.payload) {
        setStats(envelope.payload)
      }
      setLoading(false)
    })
  })

  const healthIssues = health?.items.filter((item) => item.status !== 'pass') ?? []
  const recentRuns = stats?.recentRuns ?? []

  return (
    <div className="dashboard carbon-page dashboard-workbench">
      <section className="dashboard-overview-grid">
        <article className="carbon-panel dashboard-overview-main">
          <div className="carbon-panel-heading">
            <div>
              <span className="carbon-kicker">Project Overview</span>
              <h2 className="dashboard-title">{project.name}</h2>
            </div>
            <span className="carbon-panel-tag">Workspace</span>
          </div>

          <div className="dashboard-overview-metrics">
            <div className="dashboard-overview-metric">
              <span className="dashboard-overview-label">Pass rate</span>
              <strong className="dashboard-overview-value dashboard-overview-value-success">
                {stats?.passRate !== null && stats?.passRate !== undefined ? `${stats.passRate}%` : '--'}
              </strong>
            </div>
            <div className="dashboard-overview-metric">
              <span className="dashboard-overview-label">Test files</span>
              <strong className="dashboard-overview-value">{stats?.totalFiles ?? '--'}</strong>
            </div>
            <div className="dashboard-overview-metric">
              <span className="dashboard-overview-label">Cases</span>
              <strong className="dashboard-overview-value">{stats?.totalTests ?? '--'}</strong>
            </div>
            <div className="dashboard-overview-metric">
              <span className="dashboard-overview-label">Flaky</span>
              <strong className="dashboard-overview-value dashboard-overview-value-warn">{stats?.flakyCount ?? '--'}</strong>
            </div>
          </div>

          <div className="dashboard-overview-meta">
            <span>{project.activeEnvironment ?? 'local runtime'}</span>
            <span>{project.defaultBrowser ?? 'all browsers'}</span>
            <span>{project.rootPath}</span>
          </div>
        </article>

        <article className="carbon-panel dashboard-overview-side">
          <div className="carbon-panel-heading">
            <h3 className="dash-section-title">System Health</h3>
            <span className="carbon-panel-tag">{health?.overallStatus ?? 'Loading'}</span>
          </div>

          {healthIssues.length > 0 ? (
            <div className="dashboard-health-list">
              {healthIssues.slice(0, 4).map((item, index) => (
                <div key={index} className={`dashboard-health-item status-${item.status}`}>
                  <span className="dashboard-health-name">{item.check}</span>
                  <span className="dashboard-health-message">{item.message}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-health-ok">All health checks passed</div>
          )}
        </article>
      </section>

      <section className="dashboard-widget-grid">
        <article className="carbon-panel dashboard-widget dashboard-widget-recent">
          <div className="carbon-panel-heading">
            <h3 className="dash-section-title">Recent Runs</h3>
            <button className="btn-ghost btn-sm" onClick={() => navigate(`/project/${project.id}/runs`)}>
              Open Registry
            </button>
          </div>

          {loading ? (
            <div className="dash-recent-list">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton skeleton-row" />
              ))}
            </div>
          ) : recentRuns.length > 0 ? (
            <div className="dash-recent-list">
              {recentRuns.slice(0, 6).map((run: RunRecord) => (
                <button
                  key={run.id}
                  className="dash-run-row"
                  onClick={() => navigate(`/project/${project.id}/runs/${run.id}`)}
                >
                  <span className={`run-badge ${statusBadgeClass(run.status)}`}>{run.status}</span>
                  <span className="dash-run-target">{run.target ?? run.targetPath ?? 'All tests'}</span>
                  <span className="dash-run-meta">{timeAgo(run.startedAt)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <p>No runs recorded yet.</p>
            </div>
          )}
        </article>

        <article className="carbon-panel dashboard-widget">
          <div className="carbon-panel-heading">
            <h3 className="dash-section-title">Coverage Slot</h3>
            <span className="carbon-panel-tag">Reserved</span>
          </div>
          <div className="dashboard-placeholder-grid">
            {Array.from({ length: 24 }).map((_, index) => (
              <span key={index} className={`dashboard-placeholder-cell ${index % 7 === 0 ? 'is-muted' : ''}`} />
            ))}
          </div>
          <p className="dashboard-widget-note">Reserved space for suite, coverage, or artifact widgets.</p>
        </article>

        <article className="carbon-panel dashboard-widget">
          <div className="carbon-panel-heading">
            <h3 className="dash-section-title">Workspace Modules</h3>
            <span className="carbon-panel-tag">Expandable</span>
          </div>
          <div className="dashboard-module-list">
            <button type="button" className="dashboard-module-row" onClick={() => navigate(`/project/${project.id}/explorer`)}>
              <span>Explorer</span>
              <span>Files and editor</span>
            </button>
            <button type="button" className="dashboard-module-row" onClick={() => navigate(`/project/${project.id}/suites`)}>
              <span>Suites</span>
              <span>Execution groups</span>
            </button>
            <button type="button" className="dashboard-module-row" onClick={() => navigate(`/project/${project.id}/flaky`)}>
              <span>Flaky Tests</span>
              <span>Instability tracking</span>
            </button>
            <button type="button" className="dashboard-module-row" onClick={() => navigate(`/project/${project.id}/settings`)}>
              <span>Settings</span>
              <span>Runtime configuration</span>
            </button>
          </div>
        </article>
      </section>
    </div>
  )
}
