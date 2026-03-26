import { useState, useEffect, useCallback } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, HealthSnapshot, HealthItem } from '../../../shared/types/ipc'
import { WarningBanner } from './ErrorBanner'

function statusIcon(status: HealthItem['status']): string {
  switch (status) {
    case 'pass':
      return 'P'
    case 'warning':
      return 'W'
    case 'error':
      return 'E'
  }
}

function statusClass(status: HealthItem['status']): string {
  switch (status) {
    case 'pass':
      return 'health-pass'
    case 'warning':
      return 'health-warning'
    case 'error':
      return 'health-error'
  }
}

export function HealthPanel({ projectId }: { projectId: string }): JSX.Element {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    const result = await window.api.invoke<HealthSnapshot | null>(IPC.HEALTH_GET, {
      projectId,
    })
    const envelope = result as IpcEnvelope<HealthSnapshot | null>
    if (envelope.payload) {
      setSnapshot(envelope.payload)
    }
  }, [projectId])

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await window.api.invoke<HealthSnapshot>(IPC.HEALTH_REFRESH, {
      projectId,
    })
    const envelope = result as IpcEnvelope<HealthSnapshot>
    setLoading(false)

    if (envelope.error) {
      setError(envelope.error.message)
      return
    }
    if (envelope.payload) {
      setSnapshot(envelope.payload)
    }
  }, [projectId])

  useEffect(() => {
    loadHealth().then(() => {
      setTimeout(async () => {
        const result = await window.api.invoke<HealthSnapshot | null>(IPC.HEALTH_GET, {
          projectId,
        })
        const envelope = result as IpcEnvelope<HealthSnapshot | null>
        if (!envelope.payload) {
          handleRefresh()
        }
      }, 0)
    })
  }, [projectId, loadHealth, handleRefresh])

  const hasErrors = snapshot?.items.some((i) => i.status === 'error') ?? false
  const configNotReadable = snapshot?.items.find(
    (i) => i.check === 'configReadable' && i.status !== 'pass'
  )
  const baseURLHardcoded = snapshot?.items.find(
    (i) => i.check === 'baseURL' && i.status === 'warning'
  )

  return (
    <div className="health-panel">
      <div className="health-header">
        <h3>Health Checks</h3>
        <button
          className="btn btn-secondary"
          onClick={handleRefresh}
          disabled={loading}
          style={{ fontSize: 12, padding: '4px 12px' }}
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {configNotReadable && (
        <WarningBanner>
          Playwright config could not be read. testDir falls back to &quot;tests/&quot;.
          Check playwright.config.ts for syntax errors.
          {configNotReadable.value && (
            <span className="health-hint" style={{ display: 'block', marginTop: 4 }}>
              Read method: {configNotReadable.value}
            </span>
          )}
        </WarningBanner>
      )}

      {baseURLHardcoded && (
        <WarningBanner>
          baseURL appears hardcoded — PW Studio cannot override it.
          Add <code>process.env.BASE_URL</code> to playwright.config.ts to use environments.
        </WarningBanner>
      )}

      {snapshot ? (
        <>
          <div className="health-list">
            {snapshot.items.map((item) => (
              <div key={item.check} className={`health-item ${statusClass(item.status)}`}>
                <span className="health-icon">{statusIcon(item.status)}</span>
                <div className="health-info">
                  <span className="health-check-name">{item.check}</span>
                  <span className="health-message">{item.message}</span>
                  {item.actionHint && (
                    <span className="health-hint">{item.actionHint}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {snapshot.checkedAt && (
            <div className="health-footer">
              Last checked: {new Date(snapshot.checkedAt).toLocaleTimeString()}
            </div>
          )}
          {hasErrors && (
            <div className="health-warning-banner">
              Run buttons are disabled due to health errors.
              <button
                className="force-run-link"
                onClick={() => {/* stub: force run escape */}}
              >
                Force run (ignore health)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="health-loading">
          {loading ? 'Running health checks...' : 'No health data available'}
        </div>
      )}
    </div>
  )
}
