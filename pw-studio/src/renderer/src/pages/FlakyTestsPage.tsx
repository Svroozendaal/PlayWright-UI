import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, FlakyTestRecord, TestHistoryEntry } from '../../../shared/types/ipc'

export function FlakyTestsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [records, setRecords] = useState<FlakyTestRecord[]>([])
  const [selectedTest, setSelectedTest] = useState<string | null>(null)
  const [history, setHistory] = useState<TestHistoryEntry[]>([])

  const fetchFlaky = useCallback(async () => {
    if (!projectId) return
    const result = await window.api.invoke<FlakyTestRecord[]>(IPC.FLAKY_LIST, { projectId })
    const envelope = result as IpcEnvelope<FlakyTestRecord[]>
    if (envelope.payload) setRecords(envelope.payload)
  }, [projectId])

  useEffect(() => {
    fetchFlaky()
  }, [fetchFlaky])

  const handleSelectTest = async (testTitle: string): Promise<void> => {
    setSelectedTest(testTitle)
    if (!projectId) return
    const result = await window.api.invoke<TestHistoryEntry[]>(IPC.FLAKY_TEST_HISTORY, { projectId, testTitle })
    const envelope = result as IpcEnvelope<TestHistoryEntry[]>
    if (envelope.payload) setHistory(envelope.payload)
  }

  const flakinessScore = (r: FlakyTestRecord): number => {
    if (r.totalRuns === 0) return 0
    return Math.round((r.flakyCount / r.totalRuns) * 100)
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Flaky Tests</h2>
      </div>
        {records.length === 0 ? (
          <div className="empty-state">
            <h3>No flaky tests detected</h3>
            <p>Run your tests multiple times — flaky tests will appear here automatically.</p>
          </div>
        ) : (
          <div className="flaky-layout">
            <div className="flaky-list">
              {records.map((r) => {
                const score = flakinessScore(r)
                return (
                  <div
                    key={r.testTitle}
                    className={`flaky-card ${selectedTest === r.testTitle ? 'flaky-card-selected' : ''}`}
                    onClick={() => handleSelectTest(r.testTitle)}
                  >
                    <div className="flaky-card-info">
                      <span className="flaky-title">{r.testTitle}</span>
                      <span className="flaky-meta">
                        {r.totalPasses} passed / {r.totalFailures} failed across {r.totalRuns} runs
                      </span>
                    </div>
                    <div className="flaky-card-score">
                      <div className={`flaky-badge ${score > 50 ? 'flaky-high' : score > 20 ? 'flaky-medium' : 'flaky-low'}`}>
                        {score}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {selectedTest && (
              <div className="flaky-detail">
                <h3>History: {selectedTest}</h3>
                {history.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No history available</p>
                ) : (
                  <div className="flaky-history">
                    {history.map((h, i) => (
                      <div
                        key={i}
                        className={`flaky-history-item flaky-history-${h.status}`}
                        onClick={() => navigate(`/project/${projectId}/runs/${h.runId}`)}
                      >
                        <span className={`run-badge ${h.status === 'passed' ? 'badge-pass' : h.status === 'failed' ? 'badge-fail' : 'badge-cancelled'}`}>
                          {h.status}
                        </span>
                        <span className="flaky-history-date">{new Date(h.startedAt).toLocaleString()}</span>
                        {h.duration !== null && <span className="flaky-history-duration">{h.duration}ms</span>}
                        {h.retryCount > 0 && <span className="flaky-retry-badge">{h.retryCount} retries</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  )
}
