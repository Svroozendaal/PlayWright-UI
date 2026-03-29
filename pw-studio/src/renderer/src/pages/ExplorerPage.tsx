import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type {
  FileReadResult,
  ExplorerNode,
  IpcEnvelope,
  RunRequest,
  TestEditorDocument,
  TestStatusMap,
} from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'
import { ArtifactPolicyEditor } from '../components/ArtifactPolicyEditor'
import { CodeEditor } from '../components/CodeEditor'
import { RunDialog } from '../components/RunDialog'
import { TestBlockEditor } from '../components/TestBlockEditor'

type ContextMenuState = { x: number; y: number; node: ExplorerNode } | null
type DetailTab = 'code' | 'info'

const NEW_TEST_TEMPLATE = `import { test, expect } from '@playwright/test'

test('', async ({ page }) => {
  //
})
`

function findTestCaseNode(
  nodes: ExplorerNode[],
  filePath: string,
  ordinal: number | undefined
): ExplorerNode | null {
  if (ordinal === undefined) {
    return null
  }

  for (const node of nodes) {
    if (
      node.type === 'testCase' &&
      node.path === filePath &&
      node.testCaseRef?.ordinal === ordinal
    ) {
      return node
    }

    if (node.children) {
      const found = findTestCaseNode(node.children, filePath, ordinal)
      if (found) {
        return found
      }
    }
  }

  return null
}

function nodeIcon(node: ExplorerNode, expanded: boolean): string {
  switch (node.type) {
    case 'directory': return expanded ? '\u{1F4C2}' : '\u{1F4C1}'
    case 'testFile': return '\u{1F9EA}'
    case 'testCase': return '\u25C6'
    case 'file': return '\u{1F4C4}'
  }
}

function nodeIconColor(node: ExplorerNode, lastResults: TestStatusMap): string {
  if (node.type === 'testCase' && node.testTitle) {
    const status = lastResults[node.testTitle]
    if (status === 'passed') return '#22c55e'
    if (status === 'failed' || status === 'timedOut') return '#ef4444'
  }
  if (node.type === 'testFile') return '#4361ee'
  if (node.type === 'directory') return '#64748b'
  return '#94a3b8'
}

function testStatusIndicator(testTitle: string | undefined, lastResults: TestStatusMap): string {
  if (!testTitle) return ''
  const status = lastResults[testTitle]
  if (status === 'passed') return ' \u2713'
  if (status === 'failed' || status === 'timedOut') return ' \u2717'
  return ''
}

function testStatusColor(testTitle: string | undefined, lastResults: TestStatusMap): string {
  if (!testTitle) return ''
  const status = lastResults[testTitle]
  if (status === 'passed') return '#22c55e'
  if (status === 'failed' || status === 'timedOut') return '#ef4444'
  return '#94a3b8'
}

export function ExplorerPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tree, setTree] = useState<ExplorerNode[]>([])
  const [selectedNode, setSelectedNode] = useState<ExplorerNode | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [loading, setLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')
  const [lastResults, setLastResults] = useState<TestStatusMap>({})
  const [runDialog, setRunDialog] = useState<{
    targetPath?: string; target?: string; testTitleFilter?: string
  } | null>(null)
  const [createTestFilePath, setCreateTestFilePath] = useState<string | null>(null)

  // Code viewer state
  const [detailTab, setDetailTab] = useState<DetailTab>('code')
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [editContent, setEditContent] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [fileMeta, setFileMeta] = useState<{ size: number; lastModified: string } | null>(null)

  // New file creation state
  const [creatingIn, setCreatingIn] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null)
  const [newName, setNewName] = useState('')
  const newNameRef = useRef<HTMLInputElement>(null)

  const contextMenuRef = useRef<HTMLDivElement>(null)

  const fetchTree = useCallback(async (): Promise<ExplorerNode[] | null> => {
    if (!projectId) return null
    const result = await api.invoke<ExplorerNode[]>(IPC.EXPLORER_GET_TREE, { projectId })
    const envelope = result as IpcEnvelope<ExplorerNode[]>
    if (envelope.payload) {
      setTree(envelope.payload)
      setLoading(false)
      return envelope.payload
    }
    setLoading(false)
    return null
  }, [projectId])

  const fetchLastResults = useCallback(async () => {
    if (!projectId) return
    const result = await api.invoke<TestStatusMap>(IPC.EXPLORER_GET_LAST_RESULTS, { projectId })
    const envelope = result as IpcEnvelope<TestStatusMap>
    if (envelope.payload) setLastResults(envelope.payload)
  }, [projectId])

  useEffect(() => {
    void fetchTree()
    void fetchLastResults()
  }, [fetchTree, fetchLastResults])

  useSocketEvent(IPC.EXPLORER_REFRESH, () => {
    void fetchTree()
  })

  useSocketEvent(IPC.RUNS_STATUS_CHANGED, () => {
    void fetchLastResults()
  })

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) setContextMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus new name input
  useEffect(() => {
    if (creatingIn && newNameRef.current) newNameRef.current.focus()
  }, [creatingIn])

  // Keyboard: Ctrl+S to save, F5 to run, Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (isEditing && isDirty) handleSaveFile()
      }
      if (e.key === 'F5' && selectedNode) {
        e.preventDefault()
        handleQuickRun(selectedNode)
      }
      if (e.key === 'Escape') {
        setContextMenu(null)
        setRunDialog(null)
        if (creatingIn) setCreatingIn(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, isDirty, selectedNode, creatingIn])

  // Load file content when a file is selected
  useEffect(() => {
    if (!selectedNode || !projectId) {
      setFileContent(null)
      setEditContent(null)
      setFileMeta(null)
      setIsEditing(false)
      setIsDirty(false)
      return
    }
    if (selectedNode.type !== 'testFile' && selectedNode.type !== 'file') {
      setFileContent(null)
      setEditContent(null)
      setFileMeta(null)
      return
    }

    const loadFile = async (): Promise<void> => {
      const result = await api.invoke<FileReadResult>(IPC.FILE_READ, {
        projectId,
        filePath: selectedNode.path,
      })
      const envelope = result as IpcEnvelope<FileReadResult>
      if (envelope.payload) {
        setFileContent(envelope.payload.content)
        setEditContent(envelope.payload.content)
        setFileMeta({ size: envelope.payload.size, lastModified: envelope.payload.lastModified })
        setIsDirty(false)
        setIsEditing(true)
      }
    }
    loadFile()
  }, [selectedNode, projectId])

  const handleSaveFile = async (): Promise<void> => {
    if (!selectedNode || !projectId || editContent === null) return
    await api.invoke(IPC.FILE_WRITE, {
      projectId,
      filePath: selectedNode.path,
      content: editContent,
    })
    setFileContent(editContent)
    setIsDirty(false)
  }

  const handleQuickRun = async (node: ExplorerNode): Promise<void> => {
    if (!projectId) return
    const request: RunRequest = {
      projectId,
      targetPath: (node.type === 'testFile' || node.type === 'directory' || node.type === 'file') ? node.path : undefined,
      testTitleFilter: node.type === 'testCase' ? node.testTitle : undefined,
      browser: { mode: 'all' },
      headed: false,
      streamLogs: true,
    }
    const result = await api.invoke<string>(IPC.RUNS_START, request)
    const envelope = result as IpcEnvelope<string>
    if (envelope.payload) navigate(`/project/${projectId}/runs/${envelope.payload}`)
  }

  const handleCreateFile = async (): Promise<void> => {
    if (!creatingIn || !projectId || !newName.trim()) return
    const name = creatingIn.type === 'file' && !newName.includes('.')
      ? `${newName}.spec.ts`
      : newName

    const filePath = `${creatingIn.parentPath}/${name}`
    await api.invoke(IPC.FILE_CREATE, {
      projectId,
      filePath,
      content: creatingIn.type === 'file' ? NEW_TEST_TEMPLATE : '',
      isDirectory: creatingIn.type === 'folder',
    })
    setCreatingIn(null)
    setNewName('')
    // Refresh tree
    await api.invoke(IPC.EXPLORER_REFRESH, { projectId })
    await fetchTree()
  }

  const toggleExpand = (id: string): void => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, node: ExplorerNode): void => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const handleRefresh = async (): Promise<void> => {
    if (!projectId) return
    setLoading(true)
    await api.invoke(IPC.EXPLORER_REFRESH, { projectId })
    await fetchTree()
    await fetchLastResults()
    setLoading(false)
  }

  const openCreateTestEditor = (node: ExplorerNode): void => {
    setSelectedNode(node)
    setCreateTestFilePath(node.path)
    setDetailTab('code')
  }

  const handleTestEditorSaved = async (savedDocument: TestEditorDocument): Promise<void> => {
    if (!projectId) {
      return
    }

    setCreateTestFilePath(null)
    await api.invoke(IPC.EXPLORER_REFRESH, { projectId })
    const nextTree = await fetchTree()
    if (!nextTree) {
      return
    }

    const nextNode =
      savedDocument.testCaseRef
        ? findTestCaseNode(nextTree, savedDocument.filePath, savedDocument.testCaseRef.ordinal)
        : null

    if (nextNode) {
      setSelectedNode(nextNode)
    }
  }

  // Filter tree nodes
  const filterTree = (nodes: ExplorerNode[]): ExplorerNode[] => {
    if (!searchFilter) return nodes
    const lc = searchFilter.toLowerCase()
    return nodes
      .map((node) => {
        if (node.children) {
          const filteredChildren = filterTree(node.children)
          if (filteredChildren.length > 0) return { ...node, children: filteredChildren }
        }
        if (node.name.toLowerCase().includes(lc)) return node
        if (node.testTitle?.toLowerCase().includes(lc)) return node
        return null
      })
      .filter(Boolean) as ExplorerNode[]
  }

  const filteredTree = filterTree(tree)

  const renderNode = (node: ExplorerNode, depth: number): JSX.Element => {
    const isExpanded = expandedIds.has(node.id)
    const hasChildren = node.children && node.children.length > 0
    const isExpandable = node.type === 'directory' || node.type === 'testFile'
    const isSelected = selectedNode?.id === node.id

    return (
      <div key={node.id}>
        <div
          className={`tree-node ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: 8 + depth * 18 }}
          onClick={() => {
            if (isExpandable) toggleExpand(node.id)
            setSelectedNode(node)
            setCreateTestFilePath(null)
            if (node.type === 'testFile' || node.type === 'file') setDetailTab('code')
          }}
          onContextMenu={(e) => handleContextMenu(e, node)}
        >
          <span className="tree-expand-icon">
            {isExpandable ? (isExpanded ? '\u25BE' : '\u25B8') : '\u00A0'}
          </span>
          <span className="tree-node-icon" style={{ color: nodeIconColor(node, lastResults) }}>
            {nodeIcon(node, isExpanded)}
          </span>
          <span className="tree-node-name">{node.name}</span>
          {node.type === 'testCase' && (
            <span style={{ color: testStatusColor(node.testTitle, lastResults), fontSize: 11, marginLeft: 4 }}>
              {testStatusIndicator(node.testTitle, lastResults)}
            </span>
          )}
          {node.parseState === 'warning' && (
            <span className="tree-node-warning" title={node.parseWarning}>{'\u26A0'}</span>
          )}
          <button
            className="tree-run-btn"
            title="Run"
            onClick={(e) => { e.stopPropagation(); handleQuickRun(node) }}
          >
            {'\u25B6'}
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="explorer-layout">
      <div className="explorer-tree-panel">
        <div className="explorer-tree-toolbar">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Filter files..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="search-input"
            />
            {searchFilter && (
              <button className="search-clear" onClick={() => setSearchFilter('')}>{'\u2715'}</button>
            )}
          </div>
          <button className="btn-icon" onClick={handleRefresh} disabled={loading} title="Refresh">
            {'\u21BB'}
          </button>
        </div>

        {loading && tree.length === 0 ? (
          <div className="tree-empty">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" style={{ width: '70%' }} />
            <div className="skeleton skeleton-row" style={{ width: '85%' }} />
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="tree-empty">
            {searchFilter ? 'No matching files' : 'No test files found'}
          </div>
        ) : (
          <div className="tree-content">
            {filteredTree.map((node) => renderNode(node, 0))}
          </div>
        )}

        {creatingIn && (
          <div className="tree-create-input" style={{ padding: '4px 12px' }}>
            <input
              ref={newNameRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFile()
                if (e.key === 'Escape') { setCreatingIn(null); setNewName('') }
              }}
              placeholder={creatingIn.type === 'file' ? 'new-test.spec.ts' : 'folder-name'}
              className="search-input"
              style={{ fontSize: 12 }}
            />
          </div>
        )}
      </div>

      <div className="explorer-detail-panel">
        {selectedNode && projectId ? (
          <div className="detail-content">
            {selectedNode.type === 'testCase' ? (
              selectedNode.testCaseRef ? (
                <TestBlockEditor
                  projectId={projectId}
                  mode="existing"
                  filePath={selectedNode.path}
                  testCaseRef={selectedNode.testCaseRef}
                  onRun={() => void handleQuickRun(selectedNode)}
                  onRunWithOptions={() => {
                    setRunDialog({ targetPath: selectedNode.path, testTitleFilter: selectedNode.testTitle })
                  }}
                  onSaved={(savedDocument) => {
                    void handleTestEditorSaved(savedDocument)
                  }}
                />
              ) : (
                <div className="detail-warning">This test could not be opened in the visual editor because it has no stable test reference yet.</div>
              )
            ) : selectedNode.type === 'testFile' && createTestFilePath === selectedNode.path ? (
              <TestBlockEditor
                projectId={projectId}
                mode="create"
                filePath={selectedNode.path}
                onCancelCreate={() => setCreateTestFilePath(null)}
                onSaved={(savedDocument) => {
                  void handleTestEditorSaved(savedDocument)
                }}
              />
            ) : (selectedNode.type === 'testFile' || selectedNode.type === 'file') ? (
              <>
                <div className="detail-header">
                  <div className="detail-tabs">
                    <button className={`tab-btn ${detailTab === 'code' ? 'active' : ''}`} onClick={() => setDetailTab('code')}>
                      Code {isDirty && <span className="dirty-dot" />}
                    </button>
                    <button className={`tab-btn ${detailTab === 'info' ? 'active' : ''}`} onClick={() => setDetailTab('info')}>
                      Info
                    </button>
                  </div>
                  {detailTab === 'code' && (
                    <div className="detail-actions">
                      {selectedNode.type === 'testFile' && (
                        <button className="btn btn-primary btn-sm" onClick={() => handleQuickRun(selectedNode)}>
                          {'\u25B6'} Run File
                        </button>
                      )}
                      {selectedNode.type === 'testFile' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openCreateTestEditor(selectedNode)}>
                          New Test With Blocks
                        </button>
                      )}
                      {!isEditing ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>Edit</button>
                      ) : (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={handleSaveFile} disabled={!isDirty}>
                            Save
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => {
                            setEditContent(fileContent)
                            setIsEditing(false)
                            setIsDirty(false)
                          }}>
                            Discard
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {detailTab === 'code' && (
                  <div className="code-area">
                    {fileContent === null ? (
                      <div className="code-loading">Loading file...</div>
                    ) : (
                      <CodeEditor
                        value={editContent ?? fileContent}
                        onChange={(v) => {
                          setEditContent(v)
                          setIsDirty(v !== fileContent)
                        }}
                        readOnly={!isEditing}
                        height="100%"
                      />
                    )}
                  </div>
                )}

                {detailTab === 'info' && (
                  <div className="detail-info-content">
                    <div className="detail-file-info">
                      <h3>{selectedNode.name}</h3>
                      <p>{selectedNode.path}</p>
                      <p style={{ marginTop: 4, color: '#94a3b8' }}>
                        Type: {selectedNode.type}
                        {fileMeta && (
                          <> &middot; {Math.round(fileMeta.size / 1024)}KB &middot; Modified: {new Date(fileMeta.lastModified).toLocaleString()}</>
                        )}
                      </p>
                      {selectedNode.parseState === 'warning' && selectedNode.parseWarning && (
                        <div className="detail-warning">Parse warning: {selectedNode.parseWarning}</div>
                      )}
                    </div>
                    {selectedNode.type === 'testFile' && (
                      <div style={{ marginTop: 16 }}>
                        <ArtifactPolicyEditor projectId={projectId} filePath={selectedNode.path} />
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="detail-file-info">
                <h3>{selectedNode.name}</h3>
                <p>{selectedNode.path}</p>
                <p style={{ marginTop: 4, color: '#94a3b8' }}>Type: {selectedNode.type}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="detail-empty">
            <div className="detail-empty-icon">{'\u{1F4C1}'}</div>
            <p>Select a file to view its contents</p>
            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
              Right-click for more options. Press F5 to run.
            </p>
          </div>
        )}
      </div>

      {contextMenu && (
        <div ref={contextMenuRef} className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.node.type === 'directory' && (
            <>
              <button className="context-menu-item" onClick={() => { setContextMenu(null); handleQuickRun(contextMenu.node) }}>
                {'\u25B6'} Run folder
              </button>
              <button className="context-menu-item" onClick={() => {
                setContextMenu(null)
                setRunDialog({ targetPath: contextMenu.node.path })
              }}>
                Run with Options...
              </button>
              <div className="context-menu-divider" />
              <button className="context-menu-item" onClick={() => {
                setContextMenu(null)
                setCreatingIn({ parentPath: contextMenu.node.path, type: 'file' })
                setNewName('')
              }}>
                New test file
              </button>
              <button className="context-menu-item" onClick={() => {
                setContextMenu(null)
                setCreatingIn({ parentPath: contextMenu.node.path, type: 'folder' })
                setNewName('')
              }}>
                New folder
              </button>
            </>
          )}
          {(contextMenu.node.type === 'testFile' || contextMenu.node.type === 'file') && (
            <>
              <button className="context-menu-item" onClick={() => { setContextMenu(null); handleQuickRun(contextMenu.node) }}>
                {'\u25B6'} Run file
              </button>
              <button className="context-menu-item" onClick={() => {
                setContextMenu(null)
                setRunDialog({ targetPath: contextMenu.node.path })
              }}>
                Run with Options...
              </button>
              <div className="context-menu-divider" />
              <button className="context-menu-item" onClick={() => {
                setContextMenu(null)
                setSelectedNode(contextMenu.node)
                setCreateTestFilePath(null)
                setDetailTab('code')
                setIsEditing(true)
              }}>
                Edit file
              </button>
              {contextMenu.node.type === 'testFile' && (
                <button className="context-menu-item" onClick={() => {
                  setContextMenu(null)
                  openCreateTestEditor(contextMenu.node)
                }}>
                  New test with blocks
                </button>
              )}
            </>
          )}
          {contextMenu.node.type === 'testCase' && (
            <>
              <button className="context-menu-item" onClick={() => { setContextMenu(null); handleQuickRun(contextMenu.node) }}>
                {'\u25B6'} Run test
              </button>
              <button className="context-menu-item" onClick={() => {
                setContextMenu(null)
                setRunDialog({ targetPath: contextMenu.node.path, testTitleFilter: contextMenu.node.testTitle })
              }}>
                Run with Options...
              </button>
            </>
          )}
        </div>
      )}

      {runDialog && projectId && (
        <RunDialog
          projectId={projectId}
          targetPath={runDialog.targetPath}
          target={runDialog.target}
          testTitleFilter={runDialog.testTitleFilter}
          onClose={() => setRunDialog(null)}
          onStarted={(newRunId) => {
            setRunDialog(null)
            navigate(`/project/${projectId}/runs/${newRunId}`)
          }}
        />
      )}
    </div>
  )
}
