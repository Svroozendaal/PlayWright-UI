import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RunRecord, TestResultRecord, LogEvent } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'

type Tab = 'summary' | 'logs' | 'tests' | 'artifacts' | 'metadata'

function testStatusIcon(status: TestResultRecord['status']): string {
  switch (status) {
    case 'passed': return '\u2713'
    case 'failed': return '\u2717'
    case 'timedOut': return '\u23F1'
    case 'skipped': return '\u2014'
    case 'interrupted': return '\u26A0'
  }
}

export function RunDetailPage(): JSX.Element {
  const { id: projectId, runId } = useParams<{ id: string; runId: string }>()
  const navigate = useNavigate()
  const [run, setRun] = useState<RunRecord | null>(null)
  const [testResults, setTestResults] = useState<TestResultRecord[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('summary')
  const logEndRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [testSearch, setTestSearch] = useState('')
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())

  const fetchRun = useCallback(async () => {
    if (!runId) return
    const result = await api.invoke<RunRecord>(IPC.RUNS_GET_BY_ID, { runId })
    const envelope = result as IpcEnvelope<RunRecord>
    if (envelope.payload) {
      setRun(envelope.payload)
      if (envelope.payload.status === 'config-error') setTab('logs')
    }
  }, [runId])

  const fetchTestResults = useCallback(async () => {
    if (!runId) return
    const result = await api.invoke<TestResultRecord[]>(IPC.RUNS_GET_TEST_RESULTS, { runId })
    const envelope = result as IpcEnvelope<TestResultRecord[]>
    if (envelope.payload) setTestResults(envelope.payload)
  }, [runId])

  useEffect(() => {
    void fetchRun()
    void fetchTestResults()
  }, [fetchRun, fetchTestResults])

  useSocketEvent<LogEvent>(IPC.RUNS_LOG_EVENT, (event) => {
    if (event.runId === runId) {
      setLogs((prev) => [...prev, event.line])
    }
  })

  useSocketEvent(IPC.RUNS_STATUS_CHANGED, () => {
    void fetchRun()
    void fetchTestResults()
  })

  useEffect(() => {
    if (autoScroll && logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  const handleCancel = async (): Promise<void> => { if (runId) await api.invoke(IPC.RUNS_CANCEL, { runId }) }

  const handleRerun = async (): Promise<void> => {
    if (!runId) return
    const result = await api.invoke<string>(IPC.RUNS_RERUN, { runId })
    const envelope = result as IpcEnvelope<string>
    if (envelope.payload) navigate(`/project/${projectId}/runs/${envelope.payload}`)
  }

  const handleRerunFailed = async (): Promise<void> => {
    if (!runId) return
    const result = await api.invoke<string>(IPC.RUNS_RERUN_FAILED, { runId })
    const envelope = result as IpcEnvelope<string>
    if (envelope.payload) navigate(`/project/${projectId}/runs/${envelope.payload}`)
  }

  const handleRerunSingle = async (testTitle: string): Promise<void> => {
    if (!run) return
    const result = await api.invoke<string>(IPC.RUNS_START, {
      projectId,
      grepPattern: testTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      browser: run.browserJson ? JSON.parse(run.browserJson) : { mode: 'all' },
      environment: run.environment ?? undefined,
      headed: false,
      streamLogs: true,
    })
    const envelope = result as IpcEnvelope<string>
    if (envelope.payload) navigate(`/project/${projectId}/runs/${envelope.payload}`)
  }

  const handleOpenReport = async (): Promise<void> => { if (runId) await api.invoke(IPC.ARTIFACTS_OPEN_REPORT, { runId }) }
  const handleShowTrace = async (tracePath: string): Promise<void> => { if (projectId) await api.invoke(IPC.ARTIFACTS_SHOW_TRACE, { projectId, tracePath }) }
  const handleOpenArtifact = async (filePath: string): Promise<void> => { await api.invoke(IPC.ARTIFACTS_OPEN, { filePath }) }

  const toggleError = (id: string): void => {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isActive = run?.status === 'running' || run?.status === 'queued'
  const hasFailed = testResults.some((r) => r.status === 'failed' || r.status === 'timedOut')
  const hasArtifacts = testResults.some((r) => r.tracePath || r.screenshotPath || r.videoPath)
  const command = run?.commandJson ? JSON.parse(run.commandJson) as string[] : []
  const duration = run?.finishedAt && run?.startedAt
    ? Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
    : null

  const passedCount = testResults.filter((r) => r.status === 'passed').length
  const failedCount = testResults.filter((r) => r.status === 'failed' || r.status === 'timedOut').length
  const skippedCount = testResults.filter((r) => r.status === 'skipped').length

  const filteredResults = testSearch
    ? testResults.filter((r) => r.testTitle.toLowerCase().includes(testSearch.toLowerCase()))
    : testResults

  const artifactResults = testResults.filter((r) => r.tracePath || r.screenshotPath || r.videoPath)

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Run Detail</h2>
        <div className="page-header-actions">
          {!isActive && run?.reportPath && (
            <button className="btn btn-secondary btn-sm" onClick={handleOpenReport}>Open Report</button>
          )}
          {isActive && (
            <button className="btn btn-danger btn-sm" onClick={handleCancel} style={{ background: '#e74c3c', color: '#fff' }}>Cancel</button>
          )}
          {!isActive && (
            <button className="btn btn-secondary btn-sm" onClick={handleRerun}>Rerun</button>
          )}
          {run?.status === 'failed' && hasFailed && (
            <button className="btn btn-primary btn-sm" onClick={handleRerunFailed}>Rerun Failed</button>
          )}
        </div>
      </div>

      {!run ? (
        <div className="placeholder">Loading...</div>
      ) : (
        <>
          <div className="tab-bar">
            {(['summary', 'logs', 'tests', 'artifacts', 'metadata'] as Tab[]).map((t) => (
              <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
                {t === 'tests' && testResults.length > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7 }}>({testResults.length})</span>
                )}
              </button>
            ))}
          </div>

          {tab === 'summary' && (
            <div className="run-summary">
              <div className={`run-status-badge run-status-${run.status}`}>{run.status}</div>
              {run.status === 'config-error' && (
                <div className="error-message" style={{ marginTop: 12 }}>
                  Playwright could not start. Check the Logs tab for details.
                </div>
              )}
              <div className="summary-grid">
                <div><strong>Duration:</strong> {duration !== null ? `${duration}s` : 'In progress...'}</div>
                <div><strong>Tests:</strong> {passedCount} passed, {failedCount} failed, {skippedCount} skipped</div>
                <div><strong>Command:</strong> <code>{command.join(' ')}</code></div>
                {run.environment && <div><strong>Environment:</strong> {run.environment}</div>}
              </div>
            </div>
          )}

          {tab === 'logs' && (
            <div className="log-viewer">
              <div className="log-controls">
                <label className="checkbox-label">
                  <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
                  Auto-scroll
                </label>
              </div>
              <div className="log-content">
                {logs.length === 0 ? (
                  <div style={{ color: '#94a3b8', padding: 16 }}>
                    {isActive ? 'Waiting for output...' : 'No log data available'}
                  </div>
                ) : (
                  logs.map((line, i) => <div key={i} className="log-line">{line}</div>)
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {tab === 'tests' && (
            <div>
              {testResults.length > 5 && (
                <div className="search-bar" style={{ marginBottom: 12 }}>
                  <input
                    type="text"
                    placeholder="Search tests..."
                    value={testSearch}
                    onChange={(e) => setTestSearch(e.target.value)}
                    className="search-input"
                  />
                  {testSearch && (
                    <button className="search-clear" onClick={() => setTestSearch('')}>{'\u2715'}</button>
                  )}
                </div>
              )}
              <div className="test-results-list">
                {run.status === 'config-error' ? (
                  <div className="empty-state"><p>No test results — see Logs tab</p></div>
                ) : filteredResults.length === 0 ? (
                  <div className="empty-state">
                    <p>{isActive ? 'Waiting for results...' : testSearch ? 'No matching tests' : 'No test results'}</p>
                  </div>
                ) : (
                  filteredResults.map((result) => {
                    const isErrorExpanded = expandedErrors.has(result.id)
                    const errorFirstLine = result.errorMessage?.split('\n')[0] ?? ''
                    const hasMultilineError = (result.errorMessage?.split('\n').length ?? 0) > 1

                    return (
                      <div key={result.id} className={`test-result-item test-${result.status}`}>
                        <span className="test-status-icon">{testStatusIcon(result.status)}</span>
                        <div className="test-result-info">
                          <div className="test-result-header">
                            <span className="test-result-title">{result.testTitle}</span>
                            {result.duration !== null && (
                              <span className="test-result-duration">{result.duration}ms</span>
                            )}
                            {(result.status === 'failed' || result.status === 'timedOut') && (
                              <button
                                className="btn-icon btn-sm"
                                title="Rerun this test"
                                onClick={(e) => { e.stopPropagation(); handleRerunSingle(result.testTitle) }}
                              >
                                {'\u25B6'}
                              </button>
                            )}
                          </div>
                          {result.errorMessage && (
                            <div
                              className={`test-result-error ${isErrorExpanded ? 'expanded' : 'collapsed'}`}
                              onClick={() => hasMultilineError && toggleError(result.id)}
                              style={{ cursor: hasMultilineError ? 'pointer' : 'default' }}
                            >
                              {isErrorExpanded ? result.errorMessage : errorFirstLine}
                              {hasMultilineError && !isErrorExpanded && (
                                <span className="error-expand-hint"> ... (click to expand)</span>
                              )}
                            </div>
                          )}
                          {(result.tracePath || result.screenshotPath || result.videoPath) && (
                            <div className="test-artifact-links">
                              {result.tracePath && (
                                <button className="artifact-link" onClick={() => handleShowTrace(result.tracePath!)}>View Trace</button>
                              )}
                              {result.screenshotPath && (
                                <button className="artifact-link" onClick={() => handleOpenArtifact(result.screenshotPath!)}>Screenshot</button>
                              )}
                              {result.videoPath && (
                                <button className="artifact-link" onClick={() => handleOpenArtifact(result.videoPath!)}>Video</button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}

          {tab === 'artifacts' && (
            <div className="artifacts-tab">
              {run.reportPath && (
                <div className="artifact-section">
                  <h4>HTML Report</h4>
                  <button className="btn btn-primary btn-sm" onClick={handleOpenReport}>Open Playwright Report</button>
                </div>
              )}
              {run.runDir && (
                <div className="artifact-section">
                  <h4>Run Directory</h4>
                  <p className="artifact-path">{run.runDir}</p>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleOpenArtifact(run.runDir!)}>Open in Explorer</button>
                </div>
              )}
              {artifactResults.length > 0 ? (
                <div className="artifact-section">
                  <h4>Per-Test Artifacts</h4>
                  <div className="artifact-list">
                    {artifactResults.map((result) => (
                      <div key={result.id} className="artifact-item">
                        <div className="artifact-item-title">
                          <span className={`run-badge ${result.status === 'passed' ? 'badge-pass' : 'badge-fail'}`}>{result.status}</span>
                          <span>{result.testTitle}</span>
                        </div>
                        <div className="artifact-item-actions">
                          {result.tracePath && <button className="artifact-link" onClick={() => handleShowTrace(result.tracePath!)}>View Trace</button>}
                          {result.screenshotPath && <button className="artifact-link" onClick={() => handleOpenArtifact(result.screenshotPath!)}>Screenshot</button>}
                          {result.videoPath && <button className="artifact-link" onClick={() => handleOpenArtifact(result.videoPath!)}>Video</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                !run.reportPath && (
                  <div className="empty-state">
                    <h3>No artifacts</h3>
                    <p>Configure artifact capture in the Explorer's file policy editor.</p>
                  </div>
                )
              )}
            </div>
          )}

          {tab === 'metadata' && (
            <div className="run-metadata">
              <div className="summary-row"><span className="summary-label">Run ID:</span> <code>{run.id}</code></div>
              <div className="summary-row"><span className="summary-label">Browser:</span> {run.browserJson ?? 'N/A'}</div>
              <div className="summary-row"><span className="summary-label">Environment:</span> {run.environment ?? 'None'}</div>
              <div className="summary-row"><span className="summary-label">Exit Code:</span> {run.exitCode ?? 'N/A'}</div>
              <div className="summary-row"><span className="summary-label">Run Dir:</span> {run.runDir ?? 'N/A'}</div>
              {run.reportPath && <div className="summary-row"><span className="summary-label">Report:</span> {run.reportPath}</div>}
              {run.logPath && <div className="summary-row"><span className="summary-label">Log File:</span> {run.logPath}</div>}
              {run.resultsPath && <div className="summary-row"><span className="summary-label">Results JSON:</span> {run.resultsPath}</div>}
            </div>
          )}
        </>
      )}
    </div>
  )
}
