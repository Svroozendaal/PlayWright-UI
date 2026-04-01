import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type {
  BrowserSelection,
  ExplorerNode,
  IpcEnvelope,
  ProjectConfigSummary,
  RunRequest,
  Suite,
  SuiteEntry,
} from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'
import { ErrorBanner } from '../components/ErrorBanner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newEntryId(): string {
  return crypto.randomUUID()
}

/** Build a short display label for a suite entry. */
function entryLabel(entry: SuiteEntry): string {
  const parts = entry.filePath.split(/[\\/]/)
  const filename = parts[parts.length - 1] ?? entry.filePath
  return entry.testTitle ? `${filename} › ${entry.testTitle}` : filename
}

// ---------------------------------------------------------------------------
// TreePicker — modal multi-select of testFile / testCase nodes
// ---------------------------------------------------------------------------

type TreePickerProps = {
  nodes: ExplorerNode[]
  onAdd: (entries: Array<{ filePath: string; testTitle: string | null }>) => void
  onClose: () => void
}

function renderPickerNodes(
  nodes: ExplorerNode[],
  depth: number,
  selected: Set<string>,
  onToggle: (node: ExplorerNode) => void
): JSX.Element[] {
  return nodes.flatMap((node) => {
    if (node.type === 'directory' || node.type === 'file') {
      if (!node.children) return []
      const childRows = renderPickerNodes(node.children, depth + 1, selected, onToggle)
      if (childRows.length === 0) return []
      return [
        <div key={node.id} className="sp-picker-group" style={{ paddingLeft: depth * 14 }}>
          {node.name}
        </div>,
        ...childRows,
      ]
    }

    const checked = selected.has(node.id)
    const icon = node.type === 'testFile' ? '🧪' : '◆'
    const rows: JSX.Element[] = [
      <label
        key={node.id}
        className={`sp-picker-item${checked ? ' selected' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <input type="checkbox" checked={checked} onChange={() => onToggle(node)} />
        <span className="sp-picker-icon">{icon}</span>
        <span className="sp-picker-name">{node.name}</span>
      </label>,
    ]

    if (node.children) {
      rows.push(...renderPickerNodes(node.children, depth + 1, selected, onToggle))
    }

    return rows
  })
}

function TreePicker({ nodes, onAdd, onClose }: TreePickerProps): JSX.Element {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (node: ExplorerNode): void => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(node.id)) {
        next.delete(node.id)
      } else {
        next.add(node.id)
      }
      return next
    })
  }

  /** Build a reverse map of id -> node for the flat list of selectable nodes. */
  function collectSelectable(nodes: ExplorerNode[]): ExplorerNode[] {
    const result: ExplorerNode[] = []
    for (const node of nodes) {
      if (node.type === 'testFile' || node.type === 'testCase') result.push(node)
      if (node.children) result.push(...collectSelectable(node.children))
    }
    return result
  }

  const handleAdd = (): void => {
    const selectable = collectSelectable(nodes)
    const entries = selectable
      .filter((n) => selected.has(n.id))
      .map((n) => ({
        filePath: n.path,
        testTitle: n.type === 'testCase' ? (n.testTitle ?? null) : null,
      }))
    onAdd(entries)
  }

  return (
    <div className="sp-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sp-picker-modal">
        <div className="sp-picker-header">
          <span className="sp-picker-title">Add Tests to Suite</span>
          <button className="sp-picker-close btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="sp-picker-body">
          {collectSelectable(nodes).length === 0 ? (
            <div className="sp-picker-empty">No test files found in this project.</div>
          ) : (
            renderPickerNodes(nodes, 0, selected, toggle)
          )}
        </div>
        <div className="sp-picker-footer">
          <span className="sp-picker-count">{selected.size} selected</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={selected.size === 0}
            onClick={handleAdd}
          >
            Add Selected
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EntryConfigPanel — inline config for a single suite entry
// ---------------------------------------------------------------------------

type EntryConfigPanelProps = {
  entry: SuiteEntry
  testTitlesForFile: string[]
  browserProjects: string[]
  onChange: (updated: SuiteEntry) => void
}

function EntryConfigPanel({ entry, testTitlesForFile, browserProjects, onChange }: EntryConfigPanelProps): JSX.Element {
  const [addKey, setAddKey] = useState('')
  const [addVal, setAddVal] = useState('')

  const handleAddInput = (): void => {
    const k = addKey.trim()
    if (!k) return
    onChange({ ...entry, flowInputOverrides: { ...entry.flowInputOverrides, [k]: addVal } })
    setAddKey('')
    setAddVal('')
  }

  const handleRemoveInput = (key: string): void => {
    const next = { ...entry.flowInputOverrides }
    delete next[key]
    onChange({ ...entry, flowInputOverrides: next })
  }

  const handleToggleDisabledTitle = (title: string): void => {
    const next = entry.disabledTestTitles.includes(title)
      ? entry.disabledTestTitles.filter((t) => t !== title)
      : [...entry.disabledTestTitles, title]
    onChange({ ...entry, disabledTestTitles: next })
  }

  return (
    <div className="sp-entry-config">
      {/* Browser */}
      <div className="sp-config-row">
        <span className="sp-config-label">Browser</span>
        <select
          className="sp-config-select"
          value={entry.browser.mode === 'all' ? '__all__' : entry.browser.projectName}
          onChange={(e) => {
            const val = e.target.value
            const browser: BrowserSelection = val === '__all__'
              ? { mode: 'all' }
              : { mode: 'single', projectName: val }
            onChange({ ...entry, browser })
          }}
        >
          <option value="__all__">All browsers</option>
          {browserProjects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Tests within the file — only for file-level entries */}
      {entry.testTitle === null && testTitlesForFile.length > 0 && (
        <div className="sp-config-section">
          <div className="sp-config-section-title">Tests in file</div>
          <div className="sp-config-tests">
            {testTitlesForFile.map((title) => {
              const disabled = entry.disabledTestTitles.includes(title)
              return (
                <label key={title} className="sp-config-test-toggle">
                  <input
                    type="checkbox"
                    checked={!disabled}
                    onChange={() => handleToggleDisabledTitle(title)}
                  />
                  <span className={`sp-config-test-title${disabled ? ' muted' : ''}`}>{title}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Flow input overrides */}
      <div className="sp-config-section">
        <div className="sp-config-section-title">Flow input overrides</div>
        {Object.entries(entry.flowInputOverrides).map(([k, v]) => (
          <div key={k} className="sp-config-input-row">
            <span className="sp-config-input-key">{k}</span>
            <input
              className="sp-config-input-val"
              value={v}
              onChange={(e) =>
                onChange({ ...entry, flowInputOverrides: { ...entry.flowInputOverrides, [k]: e.target.value } })
              }
            />
            <button
              className="btn-icon sp-config-remove"
              onClick={() => handleRemoveInput(k)}
              title="Remove"
            >✕</button>
          </div>
        ))}
        <div className="sp-config-add-row">
          <input
            className="sp-config-input-key"
            placeholder="key"
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddInput() }}
          />
          <input
            className="sp-config-input-val"
            placeholder="value"
            value={addVal}
            onChange={(e) => setAddVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddInput() }}
          />
          <button className="btn btn-secondary btn-sm" onClick={handleAddInput}>+ Add</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SuitesPage
// ---------------------------------------------------------------------------

export function SuitesPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [suites, setSuites] = useState<Suite[]>([])
  const [selectedSuiteId, setSelectedSuiteId] = useState<string | null>(null)
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)
  const [explorerNodes, setExplorerNodes] = useState<ExplorerNode[]>([])
  const [browserProjects, setBrowserProjects] = useState<string[]>([])
  const [testTitlesMap, setTestTitlesMap] = useState<Record<string, string[]>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [newSuiteName, setNewSuiteName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [running, setRunning] = useState(false)
  const [hasActiveRun, setHasActiveRun] = useState(false)

  // Run queue — a ref so the socket event handler always sees the current value
  const runQueueRef = useRef<RunRequest[]>([])

  const selectedSuite = suites.find((s) => s.id === selectedSuiteId) ?? null

  // ---------------------------------------------------------------------------
  // Build test titles map from explorer nodes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const map: Record<string, string[]> = {}
    const collect = (nodes: ExplorerNode[]): void => {
      for (const node of nodes) {
        if (node.type === 'testCase' && node.testTitle) {
          if (!map[node.path]) map[node.path] = []
          map[node.path]!.push(node.testTitle)
        }
        if (node.children) collect(node.children)
      }
    }
    collect(explorerNodes)
    setTestTitlesMap(map)
  }, [explorerNodes])

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!projectId) return
    setLoading(true)

    const init = async (): Promise<void> => {
      const [suitesResult, treeResult, configResult, activeResult] = await Promise.all([
        api.invoke<Suite[]>(IPC.SUITES_LIST, { projectId }),
        api.invoke<ExplorerNode[]>(IPC.EXPLORER_GET_TREE, { projectId }),
        api.invoke<ProjectConfigSummary>(IPC.HEALTH_GET_CONFIG, { projectId }),
        api.invoke<string | null>(IPC.RUNS_GET_ACTIVE, { projectId }),
      ])

      const suitesEnv = suitesResult as IpcEnvelope<Suite[]>
      if (suitesEnv.payload) setSuites(suitesEnv.payload)

      const treeEnv = treeResult as IpcEnvelope<ExplorerNode[]>
      if (treeEnv.payload) setExplorerNodes(treeEnv.payload)

      const configEnv = configResult as IpcEnvelope<ProjectConfigSummary>
      if (configEnv.payload?.projects) setBrowserProjects(configEnv.payload.projects)

      const activeEnv = activeResult as IpcEnvelope<string | null>
      setHasActiveRun(!!activeEnv.payload)

      setLoading(false)
    }

    void init()
  }, [projectId])

  // Track active run state
  useSocketEvent(IPC.RUNS_STATUS_CHANGED, (data) => {
    if (!projectId) return
    const event = data as { status: string }

    void api.invoke<string | null>(IPC.RUNS_GET_ACTIVE, { projectId }).then((result) => {
      const envelope = result as IpcEnvelope<string | null>
      setHasActiveRun(!!envelope.payload)
    })

    // Advance the suite run queue when a run finishes
    if (running && (event.status === 'passed' || event.status === 'failed' || event.status === 'cancelled')) {
      const next = runQueueRef.current.shift()
      if (!next) {
        setRunning(false)
        navigate(`/project/${projectId}/runs`)
        return
      }
      void api.invoke<string>(IPC.RUNS_START, next).then((runEnv) => {
        const envelope = runEnv as IpcEnvelope<string>
        if (envelope.error) {
          setError(envelope.error)
          setRunning(false)
          runQueueRef.current = []
        }
      })
    }
  })

  // ---------------------------------------------------------------------------
  // Suite CRUD
  // ---------------------------------------------------------------------------

  const handleCreateSuite = async (): Promise<void> => {
    if (!projectId || !newSuiteName.trim()) return
    const result = await api.invoke<Suite>(IPC.SUITES_CREATE, { projectId, name: newSuiteName.trim() })
    const envelope = result as IpcEnvelope<Suite>
    if (envelope.error) { setError(envelope.error); return }
    if (envelope.payload) {
      setSuites((prev) => [...prev, envelope.payload!])
      setSelectedSuiteId(envelope.payload.id)
      setNewSuiteName('')
    }
  }

  const handleDeleteSuite = async (suiteId: string): Promise<void> => {
    if (!projectId) return
    await api.invoke(IPC.SUITES_DELETE, { projectId, suiteId })
    setSuites((prev) => prev.filter((s) => s.id !== suiteId))
    if (selectedSuiteId === suiteId) setSelectedSuiteId(null)
  }

  const handleRenameCommit = async (): Promise<void> => {
    if (!projectId || !renamingId || !renameValue.trim()) { setRenamingId(null); return }
    const result = await api.invoke<Suite>(IPC.SUITES_UPDATE, {
      projectId, suiteId: renamingId, name: renameValue.trim(),
    })
    const envelope = result as IpcEnvelope<Suite>
    if (envelope.payload) {
      setSuites((prev) => prev.map((s) => s.id === renamingId ? envelope.payload! : s))
    }
    setRenamingId(null)
  }

  // ---------------------------------------------------------------------------
  // Entry management — all mutations go through a single PUT
  // ---------------------------------------------------------------------------

  const pushEntries = useCallback(async (suiteId: string, entries: SuiteEntry[]): Promise<void> => {
    if (!projectId) return
    const result = await api.invoke<Suite>(IPC.SUITES_UPDATE, { projectId, suiteId, entries })
    const envelope = result as IpcEnvelope<Suite>
    if (envelope.payload) {
      setSuites((prev) => prev.map((s) => s.id === suiteId ? envelope.payload! : s))
    }
  }, [projectId])

  const handlePickerAdd = async (items: Array<{ filePath: string; testTitle: string | null }>): Promise<void> => {
    if (!selectedSuite) return
    setShowPicker(false)
    const newEntries: SuiteEntry[] = items.map((item) => ({
      id: newEntryId(),
      filePath: item.filePath,
      testTitle: item.testTitle,
      disabledTestTitles: [],
      enabled: true,
      flowInputOverrides: {},
      browser: { mode: 'all' },
      environment: null,
    }))
    await pushEntries(selectedSuite.id, [...selectedSuite.entries, ...newEntries])
  }

  const handleEntryChange = async (updated: SuiteEntry): Promise<void> => {
    if (!selectedSuite) return
    await pushEntries(selectedSuite.id, selectedSuite.entries.map((e) => e.id === updated.id ? updated : e))
  }

  const handleEntryToggleEnabled = async (entryId: string): Promise<void> => {
    if (!selectedSuite) return
    await pushEntries(selectedSuite.id, selectedSuite.entries.map((e) =>
      e.id === entryId ? { ...e, enabled: !e.enabled } : e
    ))
  }

  const handleEntryRemove = async (entryId: string): Promise<void> => {
    if (!selectedSuite) return
    if (expandedEntryId === entryId) setExpandedEntryId(null)
    await pushEntries(selectedSuite.id, selectedSuite.entries.filter((e) => e.id !== entryId))
  }

  const handleMoveEntry = async (entryId: string, direction: 'up' | 'down'): Promise<void> => {
    if (!selectedSuite) return
    const entries = [...selectedSuite.entries]
    const idx = entries.findIndex((e) => e.id === entryId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= entries.length) return
    const a = entries[idx]!
    const b = entries[swapIdx]!
    entries[idx] = b
    entries[swapIdx] = a
    await pushEntries(selectedSuite.id, entries)
  }

  // ---------------------------------------------------------------------------
  // Run suite — fires first run immediately; subsequent runs started from ws handler
  // ---------------------------------------------------------------------------

  const handleRunSuite = async (): Promise<void> => {
    if (!projectId || !selectedSuite || running || hasActiveRun) return
    setError(null)

    const result = await api.invoke<{ suiteId: string; runRequests: RunRequest[] }>(
      IPC.SUITES_RUN,
      { projectId, suiteId: selectedSuite.id }
    )
    const envelope = result as IpcEnvelope<{ suiteId: string; runRequests: RunRequest[] }>

    if (envelope.error) { setError(envelope.error); return }

    const requests = envelope.payload?.runRequests ?? []
    if (requests.length === 0) return

    // Queue remaining runs (index 1+); index 0 is started immediately below
    runQueueRef.current = requests.slice(1)
    setRunning(true)

    const runEnv = await api.invoke<string>(IPC.RUNS_START, requests[0])
    const runEnvTyped = runEnv as IpcEnvelope<string>
    if (runEnvTyped.error) {
      setError(runEnvTyped.error)
      setRunning(false)
      runQueueRef.current = []
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <div className="page"><div className="placeholder">Loading suites...</div></div>
  }

  const enabledCount = selectedSuite?.entries.filter((e) => e.enabled).length ?? 0

  return (
    <div className="page suites-page">
      {error && (
        <ErrorBanner
          code={error.code}
          message={error.message}
          onAction={() => setError(null)}
          actionLabel="Dismiss"
        />
      )}

      <div className="suites-layout">
        {/* ---------------------------------------------------------------- */}
        {/* Left: suite list                                                   */}
        {/* ---------------------------------------------------------------- */}
        <aside className="suites-sidebar">
          <div className="suites-sidebar-header">Suites</div>

          <nav className="suites-list">
            {suites.map((suite) => (
              <div
                key={suite.id}
                className={`suites-list-item${selectedSuiteId === suite.id ? ' active' : ''}`}
                onClick={() => { setSelectedSuiteId(suite.id); setExpandedEntryId(null) }}
              >
                {renamingId === suite.id ? (
                  <input
                    className="suites-rename-input"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void handleRenameCommit()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameCommit()
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="suites-list-name"
                    onDoubleClick={(e) => {
                      e.stopPropagation()
                      setRenamingId(suite.id)
                      setRenameValue(suite.name)
                    }}
                    title="Double-click to rename"
                  >
                    {suite.name}
                  </span>
                )}
                <span className="suites-list-count">
                  {suite.entries.filter((e) => e.enabled).length}/{suite.entries.length}
                </span>
                <button
                  className="btn-icon suites-list-delete"
                  title="Delete suite"
                  onClick={(e) => { e.stopPropagation(); void handleDeleteSuite(suite.id) }}
                >✕</button>
              </div>
            ))}
          </nav>

          <div className="suites-create-row">
            <input
              className="suites-create-input"
              placeholder="New suite name…"
              value={newSuiteName}
              onChange={(e) => setNewSuiteName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateSuite() }}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void handleCreateSuite()}
              disabled={!newSuiteName.trim()}
            >+</button>
          </div>
        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* Right: suite detail                                                */}
        {/* ---------------------------------------------------------------- */}
        <main className="suites-detail">
          {!selectedSuite ? (
            <div className="suites-empty">
              <div className="suites-empty-icon">▤</div>
              <div className="suites-empty-title">No suite selected</div>
              <div className="suites-empty-sub">Create a suite on the left, or select an existing one.</div>
            </div>
          ) : (
            <>
              <div className="suites-detail-header">
                <div className="suites-detail-title">{selectedSuite.name}</div>
                <div className="suites-detail-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowPicker(true)}
                    disabled={running}
                  >
                    + Add Tests
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={running || hasActiveRun || enabledCount === 0}
                    onClick={() => void handleRunSuite()}
                    title={
                      hasActiveRun
                        ? 'A run is already in progress'
                        : enabledCount === 0
                        ? 'No enabled entries to run'
                        : undefined
                    }
                  >
                    {running ? '⏳ Running…' : `▶ Run Suite (${enabledCount})`}
                  </button>
                </div>
              </div>

              <div className="suites-entries">
                {selectedSuite.entries.length === 0 ? (
                  <div className="suites-entries-empty">
                    No tests yet — click <strong>+ Add Tests</strong> to build the suite.
                  </div>
                ) : (
                  selectedSuite.entries.map((entry, idx) => {
                    const isExpanded = expandedEntryId === entry.id
                    const titlesForFile = testTitlesMap[entry.filePath] ?? []
                    const inputCount = Object.keys(entry.flowInputOverrides).length
                    const skippedCount = entry.disabledTestTitles.length

                    return (
                      <div
                        key={entry.id}
                        className={`suites-entry${!entry.enabled ? ' disabled' : ''}${isExpanded ? ' expanded' : ''}`}
                      >
                        <div className="suites-entry-header">
                          <input
                            type="checkbox"
                            className="suites-entry-checkbox"
                            checked={entry.enabled}
                            onChange={() => void handleEntryToggleEnabled(entry.id)}
                            title={entry.enabled ? 'Disable this entry' : 'Enable this entry'}
                          />

                          <span className="suites-entry-label" title={entry.filePath}>
                            {entryLabel(entry)}
                          </span>

                          <span className="suites-entry-browser">
                            {entry.browser.mode === 'all' ? 'all' : entry.browser.projectName}
                          </span>

                          {inputCount > 0 && (
                            <span className="suites-entry-badge" title="Flow input overrides configured">
                              {inputCount} input{inputCount !== 1 ? 's' : ''}
                            </span>
                          )}

                          {skippedCount > 0 && (
                            <span className="suites-entry-badge warn" title="Some tests in this file are skipped">
                              {skippedCount} skipped
                            </span>
                          )}

                          <div className="suites-entry-actions">
                            <button
                              className="btn-icon"
                              disabled={idx === 0}
                              onClick={() => void handleMoveEntry(entry.id, 'up')}
                              title="Move up"
                            >↑</button>
                            <button
                              className="btn-icon"
                              disabled={idx === selectedSuite.entries.length - 1}
                              onClick={() => void handleMoveEntry(entry.id, 'down')}
                              title="Move down"
                            >↓</button>
                            <button
                              className="btn-icon"
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                              title={isExpanded ? 'Collapse' : 'Configure'}
                            >
                              {isExpanded ? '▲' : '⚙'}
                            </button>
                            <button
                              className="btn-icon danger"
                              onClick={() => void handleEntryRemove(entry.id)}
                              title="Remove from suite"
                            >✕</button>
                          </div>
                        </div>

                        {isExpanded && (
                          <EntryConfigPanel
                            entry={entry}
                            testTitlesForFile={entry.testTitle === null ? titlesForFile : []}
                            browserProjects={browserProjects}
                            onChange={(updated) => void handleEntryChange(updated)}
                          />
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showPicker && (
        <TreePicker
          nodes={explorerNodes}
          onAdd={(items) => void handlePickerAdd(items)}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
