import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type {
  AvailableTestCase,
  BlockDefinition,
  BlockDisplayConfig,
  BlockFieldSchema,
  BlockFieldValue,
  BlockTemplate,
  FileReadResult,
  FlowInputDefinition,
  FlowInputMapping,
  IpcEnvelope,
  ManagedBlockTemplate,
  RecorderStatusEvent,
  RunRecord,
  SelectorSpec,
  TestBlock,
  TestBlockTemplate,
  TestCaseRef,
  TestEditorDocument,
  TestEditorLibraryPayload,
  TestEditorMode,
  TestReferenceSpec,
  TestResultRecord,
} from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'
import { CodeEditor } from './CodeEditor'
import { ErrorBanner } from './ErrorBanner'

// ---------------------------------------------------------------------------
// Block error annotation helpers
// ---------------------------------------------------------------------------

/**
 * Parse the first file:line reference out of a Playwright error stack trace.
 * Playwright errors look like: "Error: ...\n    at /abs/path/foo.spec.ts:42:10"
 * Returns the 1-based line number, or null if not found.
 */
function parseErrorLineNumber(errorMessage: string): number | null {
  const match = errorMessage.match(/:(\d+):\d+\)?$|:(\d+):\d+\s/m)
  if (!match) return null
  const raw = match[1] ?? match[2] ?? ''
  const n = parseInt(raw, 10)
  return isNaN(n) ? null : n
}

/**
 * Search fileContent for the line containing the test title declaration and
 * return the 1-based line number of the opening brace of the callback body
 * (i.e. the line after `test('title', async ({ page }) => {`).
 * Falls back to 1 if the title is not found.
 */
function findSnippetStartLine(fileContent: string, testTitle: string): number {
  const lines = fileContent.split('\n')
  // Escape special regex chars in the title
  const escaped = testTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const titlePattern = new RegExp(escaped)
  for (let i = 0; i < lines.length; i++) {
    if (titlePattern.test(lines[i] ?? '')) {
      return i + 1 // 1-based line of the test() call itself
    }
  }
  return 1
}

/**
 * Build a map of blockId → { start, end } line numbers (1-based, relative to
 * the rendered snippet string). Blocks appear in the snippet body sequentially.
 * Each block's code is found by splitting the snippet and matching regions.
 */
function computeBlockLineMap(
  snippetCode: string,
  blocks: TestBlock[]
): Record<string, { start: number; end: number }> {
  const snippetLines = snippetCode.split('\n')
  const map: Record<string, { start: number; end: number }> = {}
  let searchFromLine = 0 // 0-based index into snippetLines

  for (const block of blocks) {
    // Find the block's rendered code by looking for its title comment or any
    // unique first-line. We search forward from the previous block's end.
    // Since we don't have the rendered code per-block on the frontend, we use
    // the block title as a heuristic anchor: the AST renderer emits
    // `// <title>` as a comment line for raw_code blocks, and definitions
    // render their own output. For non-raw blocks the title won't appear in
    // code, so we assign each block an equal share of the remaining body lines.
    const remaining = blocks.slice(blocks.indexOf(block))
    const linesLeft = snippetLines.length - searchFromLine
    const share = Math.max(1, Math.floor(linesLeft / remaining.length))

    // Try to find a title-comment anchor first (works for raw_code blocks)
    let foundAt = -1
    const titleComment = `// ${block.title}`
    for (let i = searchFromLine; i < snippetLines.length; i++) {
      if ((snippetLines[i] ?? '').trim() === titleComment.trim()) {
        foundAt = i
        break
      }
    }

    const startLine = (foundAt >= 0 ? foundAt : searchFromLine) + 1 // 1-based
    const endLine = Math.min(startLine + share - 1, snippetLines.length)
    map[block.id] = { start: startLine, end: endLine }
    searchFromLine = endLine // next block starts after this one
  }

  return map
}

/**
 * Given an absolute error line, the 1-based line where the test snippet starts
 * in the file, and the block line map (relative to the snippet), return the
 * blockId whose range contains the error line, or null.
 */
function findBlockAtLine(
  absoluteErrorLine: number,
  snippetStartLine: number,
  blockLineMap: Record<string, { start: number; end: number }>
): string | null {
  // Convert absolute line to a relative line within the snippet
  // snippetStartLine is the test() call; the body starts 1 line later
  const relativeLine = absoluteErrorLine - snippetStartLine
  for (const [blockId, range] of Object.entries(blockLineMap)) {
    if (relativeLine >= range.start && relativeLine <= range.end) {
      return blockId
    }
  }
  return null
}

type DragState =
  | { type: 'block'; index: number }
  | { type: 'template'; template: BlockTemplate }
  | null

type EditorTab = 'blocks' | 'code'

type TestBlockEditorProps = {
  projectId: string
  mode: TestEditorMode
  filePath: string
  testCaseRef?: TestCaseRef
  onSaved: (document: TestEditorDocument) => void
  onCancelCreate?: () => void
  onRun?: () => void
  onRunWithOptions?: () => void
  onDebug?: () => void
  onRecordMore?: (doc: TestEditorDocument, opts: { startUrl: string; browser: string; outputPath: string }) => Promise<void>
}

export function TestBlockEditor({
  projectId,
  mode,
  filePath,
  testCaseRef,
  onSaved,
  onCancelCreate,
  onRun,
  onRunWithOptions,
  onDebug,
  onRecordMore,
}: TestBlockEditorProps): JSX.Element {
  const [document, setDocument] = useState<TestEditorDocument | null>(null)
  const [savedDocument, setSavedDocument] = useState<TestEditorDocument | null>(null)
  const [codeDraft, setCodeDraft] = useState('')
  const [codeDirty, setCodeDirty] = useState(false)
  const [definitions, setDefinitions] = useState<BlockDefinition[]>([])
  const [library, setLibrary] = useState<ManagedBlockTemplate[]>([])
  const [availableTemplateIds, setAvailableTemplateIds] = useState<string[]>([])
  const [availableTestCases, setAvailableTestCases] = useState<AvailableTestCase[]>([])
  const [activeEnvVarNames, setActiveEnvVarNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncingCode, setSyncingCode] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [tab, setTab] = useState<EditorTab>('blocks')
  const [dragState, setDragState] = useState<DragState>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [codeNotice, setCodeNotice] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [librarySearch, setLibrarySearch] = useState('')
  const [flowInputsOpen, setFlowInputsOpen] = useState(false)
  const [blockErrors, setBlockErrors] = useState<Record<string, string>>({})
  const [snippetStartLine, setSnippetStartLine] = useState(1)
  const [recordPanelOpen, setRecordPanelOpen] = useState(false)
  const [recordStartUrl, setRecordStartUrl] = useState('')
  const [recordBrowser, setRecordBrowser] = useState('chromium')
  const [recordOutputPath, setRecordOutputPath] = useState('')
  const [recording, setRecording] = useState(false)

  const fetchLastRunError = useCallback(async (
    doc: TestEditorDocument,
    overrideSnippetStartLine?: number
  ): Promise<void> => {
    const startLine = overrideSnippetStartLine ?? snippetStartLine
    const runsEnv = await api.invoke<RunRecord[]>(IPC.RUNS_LIST, { projectId })
    const runs = (runsEnv as IpcEnvelope<RunRecord[]>).payload ?? []
    const normFilePath = doc.filePath.replace(/\\/g, '/')
    const failedRun = runs.find(
      (r) =>
        r.status === 'failed' &&
        r.targetPath != null &&
        normFilePath.includes(r.targetPath.replace(/\\/g, '/'))
    )
    if (!failedRun) {
      setBlockErrors({})
      return
    }
    const resultsEnv = await api.invoke<TestResultRecord[]>(IPC.RUNS_GET_TEST_RESULTS, { runId: failedRun.id })
    const results = (resultsEnv as IpcEnvelope<TestResultRecord[]>).payload ?? []
    const failed = results.find((r) => r.testTitle === doc.testTitle && r.status === 'failed')
    if (!failed?.errorMessage) {
      setBlockErrors({})
      return
    }
    const errorLine = parseErrorLineNumber(failed.errorMessage)
    if (!errorLine) {
      setBlockErrors({})
      return
    }
    const blockLineMap = computeBlockLineMap(doc.code, doc.blocks)
    const blockId = findBlockAtLine(errorLine, startLine, blockLineMap)
    if (blockId) {
      setBlockErrors({ [blockId]: failed.errorMessage })
    } else {
      setBlockErrors({})
    }
  }, [projectId, snippetStartLine])

  useSocketEvent(IPC.RUNS_STATUS_CHANGED, () => {
    if (document) void fetchLastRunError(document)
  })

  useSocketEvent<RecorderStatusEvent>(IPC.RECORDER_STATUS, (data) => {
    if (data.status === 'idle') setRecording(false)
  })

  // Recording clears when codegen finishes (RECORDER_STATUS idle), not when the
  // state-capture run ends (that just triggers codegen to start).
  // We only clear on RUNS_STATUS_CHANGED as a fallback if the recorder never started.

  const handleStartRecording = async (): Promise<void> => {
    if (!document || !onRecordMore) return
    setRecording(true)
    setRecordPanelOpen(false)
    try {
      await onRecordMore(document, { startUrl: recordStartUrl, browser: recordBrowser, outputPath: recordOutputPath })
    } catch (err) {
      setRecording(false)
      setError({ code: 'RECORD_FAILED', message: err instanceof Error ? err.message : String(err) })
    }
  }

  useEffect(() => {
    let cancelled = false

    const loadEditor = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      setCodeNotice(null)
      setTab('blocks')
      setSelectedBlockId(null)

      const [libraryResult, documentResult] = await Promise.all([
        api.invoke<TestEditorLibraryPayload>(IPC.TEST_EDITOR_LIBRARY, { projectId }),
        api.invoke<TestEditorDocument>(IPC.TEST_EDITOR_LOAD, {
          projectId,
          filePath,
          mode,
          testCaseRef,
        }),
      ])

      if (cancelled) return

      const libraryEnvelope = libraryResult as IpcEnvelope<TestEditorLibraryPayload>
      if (libraryEnvelope.payload) {
        setDefinitions(libraryEnvelope.payload.definitions)
        setLibrary(libraryEnvelope.payload.templates)
        setAvailableTemplateIds(libraryEnvelope.payload.availableTemplateIds)
        setAvailableTestCases(libraryEnvelope.payload.availableTestCases)
        setActiveEnvVarNames(libraryEnvelope.payload.activeEnvVarNames ?? [])
      }

      const documentEnvelope = documentResult as IpcEnvelope<TestEditorDocument>
      if (documentEnvelope.error) {
        setError(documentEnvelope.error)
        setLoading(false)
        return
      }

      if (documentEnvelope.payload) {
        const doc = documentEnvelope.payload
        setDocument(doc)
        setSavedDocument(doc)
        setCodeDraft(doc.code)
        setCodeDirty(false)

        // Compute snippet start line by reading the actual file
        if (mode === 'existing') {
          const fileEnv = await api.invoke<FileReadResult>(IPC.FILE_READ, { path: doc.filePath })
          if (!cancelled) {
            const fileContent = (fileEnv as IpcEnvelope<FileReadResult>).payload?.content ?? doc.code
            const startLine = findSnippetStartLine(fileContent, doc.testTitle)
            setSnippetStartLine(startLine)
            void fetchLastRunError(doc, startLine)
          }
        }
      }

      setLoading(false)
    }

    void loadEditor()
    return () => { cancelled = true }
  }, [filePath, fetchLastRunError, mode, projectId, testCaseRef?.ordinal, testCaseRef?.testTitle])

  const isDirty = useMemo(() => {
    if (!document || !savedDocument) return false
    return JSON.stringify(document) !== JSON.stringify(savedDocument) || codeDirty
  }, [codeDirty, document, savedDocument])

  const availableLibrary = useMemo(
    () => library.filter((template) => availableTemplateIds.includes(template.id)),
    [availableTemplateIds, library]
  )

  const selectableTestCases = useMemo(() => {
    return availableTestCases.filter((entry) => {
      if (mode !== 'existing' || !testCaseRef) return true
      const normalisedCurrent = filePath.replace(/\\/g, '/')
      const normalisedEntry = entry.filePath.replace(/\\/g, '/')
      const sameFile = normalisedCurrent === normalisedEntry || normalisedCurrent.endsWith(`/${normalisedEntry}`)
      return !(sameFile && entry.ordinal === testCaseRef.ordinal)
    })
  }, [availableTestCases, filePath, mode, testCaseRef])

  const filteredLibrary = useMemo(() => {
    if (!librarySearch.trim()) return availableLibrary
    const q = librarySearch.toLowerCase()
    return availableLibrary.filter((t) => t.name.toLowerCase().includes(q))
  }, [availableLibrary, librarySearch])

  const libraryGroups = useMemo(() => groupLibraryByCategory(filteredLibrary), [filteredLibrary])
  const libraryById = useMemo(
    () => new Map(library.map((template) => [template.id, template] as const)),
    [library]
  )
  const definitionsByKind = useMemo(
    () => new Map(definitions.map((definition) => [definition.kind, definition] as const)),
    [definitions]
  )

  const updateDocument = (
    updater: (current: TestEditorDocument) => TestEditorDocument,
    options?: { keepCodeDraft?: boolean; notice?: string | null }
  ): void => {
    setDocument((current) => {
      if (!current) return current
      const next = updater(current)
      if (!options?.keepCodeDraft) {
        setCodeDraft(renderDocumentPreview(next, definitionsByKind))
        setCodeDirty(false)
        setCodeNotice(null)
      } else if (options?.notice !== undefined) {
        setCodeNotice(options.notice)
      }
      return next
    })
  }

  const handleApplyCodeToBlocks = async (): Promise<TestEditorDocument | null> => {
    if (!document) return null

    setSyncingCode(true)
    setError(null)
    const result = await api.invoke<TestEditorDocument>(IPC.TEST_EDITOR_SYNC_CODE, {
      projectId,
      filePath: document.filePath,
      mode: document.mode,
      code: codeDraft,
      testCaseRef: document.testCaseRef,
    })
    const envelope = result as IpcEnvelope<TestEditorDocument>
    setSyncingCode(false)

    if (envelope.error) {
      setError(envelope.error)
      return null
    }
    if (!envelope.payload) return null

    setDocument(envelope.payload)
    setSavedDocument((current) => current)
    setCodeDraft(envelope.payload.code)
    setCodeDirty(false)
    setCodeNotice(null)
    return envelope.payload
  }

  const handleSave = async (): Promise<void> => {
    if (!document) return

    let toSave = document
    if (tab === 'code' && codeDirty) {
      const synced = await handleApplyCodeToBlocks()
      if (!synced) return
      toSave = synced
    }

    setSaving(true)
    setError(null)
    const result = await api.invoke<TestEditorDocument>(IPC.TEST_EDITOR_SAVE, {
      projectId,
      document: toSave,
    })
    const envelope = result as IpcEnvelope<TestEditorDocument>
    setSaving(false)

    if (envelope.error) { setError(envelope.error); return }
    if (!envelope.payload) return

    setDocument(envelope.payload)
    setSavedDocument(envelope.payload)
    setCodeDraft(envelope.payload.code)
    setCodeDirty(false)
    setCodeNotice(null)
    onSaved(envelope.payload)
  }

  const handleDiscard = (): void => {
    if (!savedDocument) return
    setDocument(savedDocument)
    setCodeDraft(savedDocument.code)
    setCodeDirty(false)
    setCodeNotice(null)
    setError(null)
    setSelectedBlockId(null)
  }

  const deleteBlock = (blockId: string): void => {
    updateDocument(
      (current) => ({ ...current, blocks: current.blocks.filter((b) => b.id !== blockId) }),
      codeDirty ? { keepCodeDraft: true, notice: codeSyncNotice } : undefined
    )
    if (selectedBlockId === blockId) setSelectedBlockId(null)
  }

  const applyDrop = (targetIndex: number): void => {
    if (!document || !dragState) return

    updateDocument(
      (current) => {
        const nextBlocks = [...current.blocks]
        if (dragState.type === 'block') {
          const [moved] = nextBlocks.splice(dragState.index, 1)
          if (!moved) return current
          const insertIndex = dragState.index < targetIndex ? targetIndex - 1 : targetIndex
          nextBlocks.splice(insertIndex, 0, moved)
        } else {
          nextBlocks.splice(
            targetIndex,
            0,
            createBlockFromTemplate(dragState.template.block, nextBlocks, definitionsByKind, dragState.template.id)
          )
        }
        return { ...current, blocks: nextBlocks }
      },
      codeDirty ? { keepCodeDraft: true, notice: codeSyncNotice } : undefined
    )

    setDragState(null)
    setDropIndex(null)
  }

  if (loading) {
    return <div className="code-loading">Loading visual editor…</div>
  }

  if (!document) {
    return (
      <div className="detail-info-content">
        {error
          ? <ErrorBanner code={error.code} message={error.message} />
          : <p>Unable to load the visual test editor.</p>}
      </div>
    )
  }

  return (
    <div className="bed">
      {/* ===== Header ===== */}
      <div className="bed-header">
        <div className="bed-title-section">
          <span className="bed-label">Test title</span>
          <input
            className="bed-title-input"
            value={document.testTitle}
            onChange={(e) => {
              const nextTitle = e.target.value
              updateDocument(
                (current) => ({ ...current, testTitle: nextTitle }),
                codeDirty ? { keepCodeDraft: true, notice: codeSyncNotice } : undefined
              )
            }}
          />
          <span className="bed-path">{document.filePath}</span>
        </div>

        <div className="bed-tabs">
          <button
            className={`bed-tab ${tab === 'blocks' ? 'active' : ''}`}
            onClick={() => setTab('blocks')}
          >
            <span className="bed-tab-icon">⊞</span>
            Blocks
            {isDirty && tab === 'blocks' && <span className="dirty-dot" />}
          </button>
          <button
            className={`bed-tab ${tab === 'code' ? 'active' : ''}`}
            onClick={() => setTab('code')}
          >
            <span className="bed-tab-icon">⟨/⟩</span>
            Code
            {(codeDirty || (isDirty && tab === 'code')) && <span className="dirty-dot" />}
          </button>
        </div>

        <div className="bed-actions">
          {mode === 'existing' && onRun && (
            <button className="btn btn-primary btn-sm" onClick={onRun}>
              ▶ Run
            </button>
          )}
          {mode === 'existing' && onDebug && (
            <button className="btn btn-secondary btn-sm" onClick={onDebug}>
              ⬡ Debug
            </button>
          )}
          {onRecordMore && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setRecordPanelOpen((o) => !o)}
              disabled={recording}
            >
              {recording ? '⏺ Recording…' : '⏺ Record…'}
            </button>
          )}
          {mode === 'existing' && onRunWithOptions && (
            <button className="btn btn-secondary btn-sm" onClick={onRunWithOptions}>
              Options…
            </button>
          )}
          {mode === 'create' && onCancelCreate && (
            <button className="btn btn-secondary btn-sm" onClick={onCancelCreate}>
              Cancel
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDiscard}
            disabled={!isDirty || saving || syncingCode}
          >
            Discard
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSave()}
            disabled={saving || syncingCode}
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create Test' : 'Save'}
          </button>
        </div>
      </div>

      {/* ===== Record panel ===== */}
      {recordPanelOpen && onRecordMore && (
        <div className="bed-record-panel">
          {mode === 'existing' ? (
            <span className="bed-record-hint">
              Existing steps will be replayed automatically, then the Inspector opens for recording.
            </span>
          ) : (
            <input
              className="bed-record-input"
              type="text"
              placeholder="Start URL (optional)"
              value={recordStartUrl}
              onChange={(e) => setRecordStartUrl(e.target.value)}
            />
          )}
          <select
            className="bed-record-select"
            value={recordBrowser}
            onChange={(e) => setRecordBrowser(e.target.value)}
          >
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </select>
          {mode === 'create' && (
            <input
              className="bed-record-input bed-record-output"
              type="text"
              placeholder="Output path (e.g. tests/my-test.spec.ts)"
              value={recordOutputPath}
              onChange={(e) => setRecordOutputPath(e.target.value)}
            />
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleStartRecording()}
            disabled={recording || (mode === 'create' && !recordOutputPath.trim())}
          >
            Start Recording
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setRecordPanelOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* ===== Banners ===== */}
      {error && <ErrorBanner code={error.code} message={error.message} />}
      {document.warnings.length > 0 && (
        <div className="warning-banner">{document.warnings.join(' ')}</div>
      )}
      {codeNotice && <div className="warning-banner">{codeNotice}</div>}

      {/* ===== Blocks tab ===== */}
      {tab === 'blocks' ? (
        <div className="bed-body">
          {/* Left: canvas */}
          <div className="bed-canvas-area">
            {/* Flow inputs (collapsible) */}
            {document.flowInputs.length > 0 || true ? (
              <div className="bed-flow-inputs-panel">
                <div
                  className="bed-flow-inputs-header"
                  onClick={() => setFlowInputsOpen((o) => !o)}
                >
                  <span>Flow Inputs</span>
                  {document.flowInputs.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 6 }}>
                      {document.flowInputs.length} defined
                    </span>
                  )}
                  <span className="bed-flow-inputs-toggle">{flowInputsOpen ? '▲' : '▼'}</span>
                </div>
                {flowInputsOpen && (
                  <div className="bed-flow-inputs-body">
                    <FlowInputsEditor
                      flowInputs={document.flowInputs}
                      onChange={(flowInputs) =>
                        updateDocument(
                          (current) => ({ ...current, flowInputs }),
                          codeDirty ? { keepCodeDraft: true, notice: codeSyncNotice } : undefined
                        )
                      }
                    />
                  </div>
                )}
              </div>
            ) : null}

            {/* Canvas scroll */}
            <div className="bed-canvas-scroll">
              <div className="bed-canvas-title">Visual Steps</div>
              <div className="bed-canvas-subtitle">
                Sequence of automated actions for this test.
              </div>

              <div className="bed-flow">
                {/* Drop zone before first block */}
                <DropZone
                  active={dropIndex === 0}
                  onDragOver={() => setDropIndex(0)}
                  onDrop={() => applyDrop(0)}
                />

                {document.blocks.length === 0 ? (
                  <div
                    className={`bed-empty ${dragState ? 'drag-over' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDropIndex(0) }}
                    onDrop={(e) => { e.preventDefault(); applyDrop(0) }}
                  >
                    <span className="bed-empty-icon">+</span>
                    <span>Drag a block here to add a step</span>
                  </div>
                ) : (
                  document.blocks.map((block, index) => {
                    const definition = definitionsByKind.get(block.kind)
                    const category = definition?.category ?? 'Advanced'
                    const isSelected = selectedBlockId === block.id

                    return (
                      <div key={block.id}>
                        <div className="bed-node">
                          <div className="bed-node-number">{index + 1}</div>
                          <div
                            className={`bed-node-card${isSelected ? ' selected' : ''}`}
                            data-cat={category}
                            draggable={!isSelected}
                            onDragStart={(e) => {
                              if (isSelected) { e.preventDefault(); return }
                              e.dataTransfer.effectAllowed = 'move'
                              setDragState({ type: 'block', index })
                            }}
                            onDragEnd={() => {
                              setDragState(null)
                              setDropIndex(null)
                            }}
                          >
                            {/* Card header — always visible */}
                            <div
                              className="bed-node-header"
                              onClick={() =>
                                setSelectedBlockId(isSelected ? null : block.id)
                              }
                            >
                              <span
                                className="bed-node-kind-badge"
                                data-cat={category}
                              >
                                {category}
                              </span>
                              <div className="bed-node-content">
                                <div className="bed-node-title">{block.title}</div>
                                <div className="bed-node-summary">
                                  {renderCompactSummary(block, libraryById, definitionsByKind)}
                                </div>
                              </div>
                              <div className="bed-node-actions">
                                <button
                                  className="bed-node-btn delete"
                                  title="Delete step"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteBlock(block.id)
                                  }}
                                >
                                  ✕
                                </button>
                                <button
                                  className="bed-node-btn expand"
                                  title={isSelected ? 'Collapse' : 'Expand'}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedBlockId(isSelected ? null : block.id)
                                  }}
                                >
                                  {isSelected ? '▲' : '▼'}
                                </button>
                              </div>
                            </div>

                            {/* Properties panel — only when selected */}
                            {isSelected && (
                              <div className="bed-node-body">
                                <BlockFields
                                  block={block}
                                  definition={definition}
                                  flowInputs={document.flowInputs}
                                  constants={document.constants}
                                  locatorConstants={document.locatorConstants ?? []}
                                  availableTestCases={selectableTestCases}
                                  activeEnvVarNames={activeEnvVarNames}
                                  onChange={(nextBlock) =>
                                    updateDocument(
                                      (current) => ({
                                        ...current,
                                        blocks: current.blocks.map((b) =>
                                          b.id === block.id ? nextBlock : b
                                        ),
                                      }),
                                      codeDirty
                                        ? { keepCodeDraft: true, notice: codeSyncNotice }
                                        : undefined
                                    )
                                  }
                                />
                              </div>
                            )}

                            {/* Error strip — shown when the last run failed at this block */}
                            {blockErrors[block.id] && (
                              <div
                                className="bed-node-error-strip"
                                title={blockErrors[block.id]}
                              >
                                <span className="bed-node-error-icon">✕</span>
                                <span className="bed-node-error-text">
                                  {(blockErrors[block.id] ?? '').split('\n')[0]}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Connector arrow (not after last block) */}
                        {index < document.blocks.length - 1 && (
                          <div className="bed-connector" />
                        )}

                        {/* Drop zone after each block */}
                        <DropZone
                          active={dropIndex === index + 1}
                          onDragOver={() => setDropIndex(index + 1)}
                          onDrop={() => applyDrop(index + 1)}
                        />
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="bed-sidebar">
            {/* Block library */}
            <div className="bed-library">
              <div className="bed-library-header">
                <span className="bed-library-title">Block Library</span>
                <div className="bed-library-search-wrap">
                  <input
                    className="bed-library-search"
                    placeholder="Search blocks…"
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                  />
                  {librarySearch && (
                    <button
                      className="bed-library-search-clear"
                      onClick={() => setLibrarySearch('')}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="bed-library-body">
                {libraryGroups.length === 0 ? (
                  <div className="bed-library-empty">No blocks match your search.</div>
                ) : (
                  libraryGroups.map(([category, entries]) => (
                    <div key={category} className="bed-library-group">
                      <div className="bed-library-category" data-cat={category}>
                        {category}
                      </div>
                      {entries.map((template) => {
                        const def = definitionsByKind.get(template.block.kind)
                        return (
                          <button
                            key={template.id}
                            className="bed-library-item"
                            draggable
                            title={def?.name ?? template.name}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'copyMove'
                              setDragState({ type: 'template', template })
                            }}
                            onDragEnd={() => {
                              setDragState(null)
                              setDropIndex(null)
                            }}
                            onClick={() =>
                              applyLibraryTemplate(template, definitionsByKind, codeDirty, updateDocument)
                            }
                          >
                            <div className="bed-library-item-text">
                              <div className="bed-library-item-name">{template.name}</div>
                            </div>
                            <span className="bed-library-item-drag">⠿</span>
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Browser instance placeholder */}
            <div className="bed-browser-instance">
              <div className="bed-browser-header">
                Browser Instance
                <span className="bed-browser-badge">Chromium</span>
              </div>
              <div className="bed-browser-preview">
                <span className="bed-browser-preview-icon">🖥</span>
                <span>Live preview coming soon</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ===== Code tab ===== */
        <div className="bed-code-area">
          <div className="bed-code-toolbar">
            <span className="bed-code-hint">
              This code is the saved source-of-truth that PW Studio will execute.
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void handleApplyCodeToBlocks()}
              disabled={syncingCode}
            >
              {syncingCode ? 'Applying…' : 'Apply Code to Blocks'}
            </button>
          </div>
          <div className="code-area">
            <CodeEditor
              value={codeDraft}
              onChange={(value) => {
                setCodeDraft(value)
                setCodeDirty(value !== document.code)
              }}
              readOnly={false}
              height="100%"
            />
          </div>
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   Drop Zone
   ========================================================================== */
function DropZone({
  active,
  onDragOver,
  onDrop,
}: {
  active: boolean
  onDragOver: () => void
  onDrop: () => void
}): JSX.Element {
  return (
    <div
      className={`bed-drop-zone ${active ? 'active' : ''}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver() }}
      onDrop={(e) => { e.preventDefault(); onDrop() }}
    />
  )
}

/* ==========================================================================
   Flow Inputs Editor
   ========================================================================== */
function FlowInputsEditor({
  flowInputs,
  onChange,
}: {
  flowInputs: FlowInputDefinition[]
  onChange: (flowInputs: FlowInputDefinition[]) => void
}): JSX.Element {
  const createInput = (): void => {
    const nextIndex = flowInputs.length + 1
    onChange([
      ...flowInputs,
      { id: crypto.randomUUID(), name: `Input${nextIndex}`, defaultValue: '', exposeAtRunStart: false },
    ])
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={createInput}>
          Add Input
        </button>
      </div>
      {flowInputs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '4px 0' }}>
          No flow inputs defined.
        </div>
      ) : (
        flowInputs.map((input, index) => (
          <div key={input.id} className="bed-fi-row">
            <input
              className="bed-fi-input"
              value={input.name}
              onChange={(e) =>
                onChange(flowInputs.map((entry) =>
                  entry.id === input.id ? { ...entry, name: e.target.value } : entry
                ))
              }
              placeholder="Name"
            />
            <input
              className="bed-fi-input"
              value={input.defaultValue}
              onChange={(e) =>
                onChange(flowInputs.map((entry) =>
                  entry.id === input.id ? { ...entry, defaultValue: e.target.value } : entry
                ))
              }
              placeholder="Default value"
            />
            <label className="bed-fi-toggle">
              <input
                type="checkbox"
                checked={input.exposeAtRunStart}
                onChange={(e) =>
                  onChange(flowInputs.map((entry) =>
                    entry.id === input.id ? { ...entry, exposeAtRunStart: e.target.checked } : entry
                  ))
                }
              />
              Run start
            </label>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn-icon"
                title="Move up"
                disabled={index === 0}
                onClick={() => onChange(moveArrayItem(flowInputs, index, index - 1))}
              >
                ↑
              </button>
              <button
                className="btn-icon"
                title="Move down"
                disabled={index === flowInputs.length - 1}
                onClick={() => onChange(moveArrayItem(flowInputs, index, index + 1))}
              >
                ↓
              </button>
              <button
                className="btn-icon"
                title="Delete"
                onClick={() => onChange(flowInputs.filter((entry) => entry.id !== input.id))}
              >
                ✕
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

/* ==========================================================================
   Variable Picker
   ========================================================================== */
function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  currentValue: string,
  onChange: (v: string) => void,
  snippet: string
): void {
  const pos = el?.selectionStart ?? currentValue.length
  const next = currentValue.slice(0, pos) + snippet + currentValue.slice(pos)
  onChange(next)
  requestAnimationFrame(() => {
    el?.setSelectionRange(pos + snippet.length, pos + snippet.length)
    el?.focus()
  })
}

function FlowAwareInput({
  value,
  placeholder,
  flowInputs,
  constants,
  activeEnvVarNames,
  onChange,
}: {
  value: string
  placeholder?: string
  flowInputs: FlowInputDefinition[]
  constants: string[]
  activeEnvVarNames: string[]
  onChange: (v: string) => void
}): JSX.Element {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={ref}
        type="text"
        placeholder={placeholder}
        value={value}
        style={{ paddingRight: 28 }}
        onChange={(e) => onChange(e.target.value)}
      />
      <VariablePickerButton
        flowInputs={flowInputs}
        constants={constants}
        activeEnvVarNames={activeEnvVarNames}
        onInsert={(snippet) => insertAtCursor(ref.current, value, onChange, snippet)}
      />
    </div>
  )
}

function FlowAwareTextarea({
  value,
  placeholder,
  rows,
  flowInputs,
  constants,
  activeEnvVarNames,
  onChange,
}: {
  value: string
  placeholder?: string
  rows?: number
  flowInputs: FlowInputDefinition[]
  constants: string[]
  activeEnvVarNames: string[]
  onChange: (v: string) => void
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={ref}
        rows={rows ?? 4}
        placeholder={placeholder}
        value={value}
        style={{ paddingRight: 28 }}
        onChange={(e) => onChange(e.target.value)}
      />
      <VariablePickerButton
        flowInputs={flowInputs}
        constants={constants}
        activeEnvVarNames={activeEnvVarNames}
        onInsert={(snippet) => insertAtCursor(ref.current, value, onChange, snippet)}
      />
    </div>
  )
}

function VariablePickerButton({
  flowInputs,
  constants,
  activeEnvVarNames,
  onInsert,
}: {
  flowInputs: FlowInputDefinition[]
  constants: string[]
  activeEnvVarNames: string[]
  onInsert: (snippet: string) => void
}): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (constants.length === 0 && flowInputs.length === 0 && activeEnvVarNames.length === 0) return null

  return (
    <div ref={ref} style={{ position: 'absolute', right: 4, top: 6, zIndex: 10 }}>
      <button
        type="button"
        className="var-picker-btn"
        title="Insert variable or constant"
        onClick={() => setOpen((v) => !v)}
      >
        {'{}'}
      </button>
      {open && (
        <div className="var-picker-menu">
          {constants.length > 0 && (
            <>
              <div className="var-picker-section-label">Constants</div>
              {constants.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="var-picker-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onInsert(`{{${name}}}`)
                    setOpen(false)
                  }}
                >
                  {name}
                </button>
              ))}
            </>
          )}
          {flowInputs.length > 0 && (
            <>
              <div className="var-picker-section-label">Flow Inputs</div>
              {flowInputs.map((fi) => (
                <button
                  key={fi.name}
                  type="button"
                  className="var-picker-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onInsert(`{{${fi.name}}}`)
                    setOpen(false)
                  }}
                >
                  {fi.name}
                </button>
              ))}
            </>
          )}
          {activeEnvVarNames.length > 0 && (
            <>
              <div className="var-picker-section-label">Environment Variables</div>
              {activeEnvVarNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="var-picker-item"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    onInsert(`{{env.${name}}}`)
                    setOpen(false)
                  }}
                >
                  {name}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   Block Fields
   ========================================================================== */
function BlockFields({
  block,
  definition,
  flowInputs,
  constants,
  locatorConstants,
  availableTestCases,
  activeEnvVarNames,
  onChange,
}: {
  block: TestBlock
  definition?: BlockDefinition
  flowInputs: FlowInputDefinition[]
  constants: string[]
  locatorConstants: string[]
  availableTestCases: AvailableTestCase[]
  activeEnvVarNames: string[]
  onChange: (block: TestBlock) => void
}): JSX.Element {
  if (!definition) {
    return (
      <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-4)' }}>
        No editor definition is available for this block kind.
      </div>
    )
  }

  return (
    <div className="bed-node-fields">
      {definition.fields.map((field) => (
        <FieldEditor
          key={field.key}
          block={block}
          field={field}
          value={block.values[field.key]}
          flowInputs={flowInputs}
          constants={constants}
          locatorConstants={locatorConstants}
          availableTestCases={availableTestCases}
          activeEnvVarNames={activeEnvVarNames}
          onChange={(value) =>
            onChange({ ...block, values: { ...block.values, [field.key]: value } })
          }
        />
      ))}
    </div>
  )
}

/* ==========================================================================
   Field Editor
   ========================================================================== */
function FieldEditor({
  block,
  field,
  value,
  flowInputs,
  constants,
  locatorConstants,
  availableTestCases,
  activeEnvVarNames,
  onChange,
}: {
  block: TestBlock
  field: BlockFieldSchema
  value: BlockFieldValue | undefined
  flowInputs: FlowInputDefinition[]
  constants: string[]
  locatorConstants: string[]
  availableTestCases: AvailableTestCase[]
  activeEnvVarNames: string[]
  onChange: (value: BlockFieldValue) => void
}): JSX.Element {
  if (block.kind === 'constants_group' && field.key === 'definitions') {
    return (
      <ConstantsGroupEditor
        value={getStringValue(value)}
        onChange={(nextValue) => onChange(nextValue)}
      />
    )
  }

  switch (field.type) {
    case 'textarea':
      return (
        <label>
          {field.label}
          <FlowAwareTextarea
            value={getStringValue(value)}
            placeholder={field.placeholder}
            rows={field.rows}
            flowInputs={flowInputs}
            constants={constants}
            activeEnvVarNames={activeEnvVarNames}
            onChange={(v) => onChange(v)}
          />
        </label>
      )
    case 'select':
      return (
        <label>
          {field.label}
          <select
            className="form-select"
            value={getStringValue(value)}
            onChange={(e) => onChange(e.target.value)}
          >
            {(field.options ?? []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      )
    case 'checkbox':
      return (
        <label className="block-library-checkbox">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          {field.label}
        </label>
      )
    case 'selector':
      return (
        <SelectorEditor
          label={field.label}
          value={getSelectorValue(value)}
          flowInputs={flowInputs}
          constants={constants}
          locatorConstants={locatorConstants}
          activeEnvVarNames={activeEnvVarNames}
          onChange={onChange}
        />
      )
    case 'test_case':
      return (
        <TestReferenceEditor
          label={field.label}
          block={block}
          value={getTestReferenceValue(value)}
          flowInputs={flowInputs}
          availableTestCases={availableTestCases}
          onChange={onChange}
        />
      )
    default:
      return (
        <label>
          {field.label}
          <FlowAwareInput
            value={getStringValue(value)}
            placeholder={field.placeholder}
            flowInputs={flowInputs}
            constants={constants}
            activeEnvVarNames={activeEnvVarNames}
            onChange={(v) => onChange(v)}
          />
        </label>
      )
  }
}

/* ==========================================================================
   Selector Editor
   ========================================================================== */
function SelectorEditor({
  label,
  value,
  flowInputs,
  constants,
  locatorConstants,
  activeEnvVarNames,
  onChange,
}: {
  label: string
  value: SelectorSpec | null
  flowInputs: FlowInputDefinition[]
  constants: string[]
  locatorConstants: string[]
  activeEnvVarNames: string[]
  onChange: (value: BlockFieldValue) => void
}): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const spec = value ?? { strategy: 'role', value: '', name: '' }

  useEffect(() => {
    if (!pickerOpen) return
    const handler = (e: MouseEvent): void => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [pickerOpen])

  const update = (patch: Partial<SelectorSpec>): void => {
    onChange({ ...spec, ...patch } as SelectorSpec)
  }

  const linkToVar = (name: string): void => {
    onChange({ ...spec, varName: name } as SelectorSpec)
    setPickerOpen(false)
  }

  const unlink = (): void => {
    onChange({ ...spec, varName: undefined } as SelectorSpec)
  }

  const headerRight = locatorConstants.length > 0 ? (
    <div ref={pickerRef} style={{ position: 'relative' }}>
      <button
        className={`selector-var-btn${pickerOpen ? ' active' : ''}`}
        title="Link selector to a locator variable"
        onClick={() => setPickerOpen((o) => !o)}
      >
        {'{ }'}
      </button>
      {pickerOpen && (
        <div className="selector-var-menu">
          <div className="selector-var-menu-label">Link to variable</div>
          {locatorConstants.map((name) => (
            <button
              key={name}
              className={`selector-var-item${spec.varName === name ? ' selected' : ''}`}
              onClick={() => linkToVar(name)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null

  if (spec.varName) {
    return (
      <div>
        <div className="selector-field-header">
          <span className="selector-field-label">{label}</span>
          {headerRight}
        </div>
        <div className="selector-linked">
          <span className="selector-linked-label">
            <code>{spec.varName}</code>
          </span>
          <button
            className="selector-unlink-btn"
            title="Unlink from variable and edit selector directly"
            onClick={unlink}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="selector-field-header">
        <span className="selector-field-label">{label}</span>
        {headerRight}
      </div>
      <div className="bed-selector-grid">
        <label>
          Strategy
          <select
            className="form-select"
            value={spec.strategy}
            onChange={(e) => update({ strategy: e.target.value as SelectorSpec['strategy'] })}
          >
            <option value="role">Role</option>
            <option value="text">Text</option>
            <option value="label">Label</option>
            <option value="test_id">Test ID</option>
            <option value="placeholder">Placeholder</option>
            <option value="css">CSS</option>
          </select>
        </label>
        <label>
          Value
          <FlowAwareInput
            value={spec.value}
            flowInputs={flowInputs}
            constants={constants}
            activeEnvVarNames={activeEnvVarNames}
            onChange={(v) => update({ value: v })}
          />
        </label>
        {spec.strategy === 'role' && (
          <label>
            Name (optional)
            <FlowAwareInput
              value={spec.name ?? ''}
              flowInputs={flowInputs}
              constants={constants}
              activeEnvVarNames={activeEnvVarNames}
              onChange={(v) => update({ name: v })}
            />
          </label>
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   Test Reference Editor
   ========================================================================== */
function TestReferenceEditor({
  label,
  block,
  value,
  flowInputs,
  availableTestCases,
  onChange,
}: {
  label: string
  block: TestBlock
  value: TestReferenceSpec | null
  flowInputs: FlowInputDefinition[]
  availableTestCases: AvailableTestCase[]
  onChange: (value: BlockFieldValue) => void
}): JSX.Element {
  const inputMappings = getFlowInputMappings(block.values['inputMappings'])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label>
        {label}
        <select
          className="form-select"
          value={value ? `${value.filePath}::${value.ordinal}` : ''}
          onChange={(e) => {
            const [fp, ordStr] = e.target.value.split('::')
            const ord = Number(ordStr)
            const tc = availableTestCases.find(
              (t) => t.filePath === fp && t.ordinal === ord
            )
            if (tc) {
              onChange({ filePath: tc.filePath, ordinal: tc.ordinal, testTitle: tc.testTitle })
            }
          }}
        >
          <option value="">Select a test…</option>
          {availableTestCases.map((tc) => (
            <option key={`${tc.filePath}::${tc.ordinal}`} value={`${tc.filePath}::${tc.ordinal}`}>
              {tc.testTitle}
            </option>
          ))}
        </select>
      </label>
      {flowInputs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Input Mappings
          </span>
          {flowInputs.map((fi) => {
            const mapping = inputMappings.find((m) => m.targetName === fi.name) ?? {
              targetName: fi.name,
              source: 'literal' as const,
              value: '',
            }
            const updateMapping = (patch: Partial<FlowInputMapping>): void => {
              const next = inputMappings.filter((m) => m.targetName !== fi.name)
              next.push({ ...mapping, ...patch })
              onChange(next as BlockFieldValue)
            }
            return (
              <div key={fi.name} style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{fi.name}</span>
                <select
                  className="form-select"
                  style={{ fontSize: 12, padding: '4px 8px', minWidth: 100 }}
                  value={mapping.source}
                  onChange={(e) => updateMapping({ source: e.target.value as FlowInputMapping['source'] })}
                >
                  <option value="literal">Literal</option>
                  <option value="flow_input">Flow input</option>
                  <option value="env_var">Env variable</option>
                </select>
                <input
                  type="text"
                  value={mapping.value}
                  onChange={(e) => updateMapping({ value: e.target.value })}
                  placeholder={mapping.source === 'flow_input' ? 'Input name' : mapping.source === 'env_var' ? 'Variable name' : 'Value'}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   Constants Group Editor
   ========================================================================== */
function ConstantsGroupEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const [entries, setEntries] = useState(() => parseConstantDefinitions(value))

  const commit = (next: ConstantEntry[]): void => {
    setEntries(next)
    onChange(serializeConstantDefinitions(next))
  }

  return (
    <div className="bed-constants-editor">
      <div className="bed-constants-header">
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Constants</span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => commit([...entries, { name: '', value: "''" }])}
        >
          Add
        </button>
      </div>
      <div className="bed-constants-list">
        {entries.map((entry, index) => (
          <div key={index} className="bed-constants-row">
            <input
              type="text"
              value={entry.name}
              onChange={(e) => {
                const next = [...entries]
                next[index] = { ...entry, name: e.target.value }
                commit(next)
              }}
              placeholder="name"
            />
            <input
              type="text"
              value={entry.value}
              onChange={(e) => {
                const next = [...entries]
                next[index] = { ...entry, value: e.target.value }
                commit(next)
              }}
              placeholder="'value'"
            />
            <button
              className="btn-icon"
              onClick={() => commit(entries.filter((_, i) => i !== index))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==========================================================================
   Shared notice string
   ========================================================================== */
const codeSyncNotice =
  'The code tab has unsynced edits. Apply code to blocks or discard them to refresh the generated code preview.'

/* ==========================================================================
   Library helpers
   ========================================================================== */
function applyLibraryTemplate(
  template: BlockTemplate,
  definitionsByKind: Map<string, BlockDefinition>,
  codeDirty: boolean,
  updateDocument: (
    updater: (current: TestEditorDocument) => TestEditorDocument,
    options?: { keepCodeDraft?: boolean; notice?: string | null }
  ) => void
): void {
  updateDocument(
    (current) => {
      const nextBlocks = [...current.blocks]
      nextBlocks.push(createBlockFromTemplate(template.block, nextBlocks, definitionsByKind, template.id))
      return { ...current, blocks: nextBlocks }
    },
    codeDirty ? { keepCodeDraft: true, notice: codeSyncNotice } : undefined
  )
}

function createBlockFromTemplate(
  template: TestBlockTemplate,
  existingBlocks: TestBlock[],
  definitionsByKind: Map<string, BlockDefinition>,
  templateId?: string
): TestBlock {
  const definition = definitionsByKind.get(template.kind)
  return {
    kind: template.kind,
    values: { ...template.values },
    id: crypto.randomUUID(),
    title: createUniqueBlockTitle(definition?.defaultTitle ?? template.kind.replace(/_/g, ' '), existingBlocks),
    templateId,
  }
}

function groupLibraryByCategory(templates: BlockTemplate[]): [string, BlockTemplate[]][] {
  const grouped = new Map<string, BlockTemplate[]>()
  for (const template of templates) {
    const existing = grouped.get(template.category) ?? []
    existing.push(template)
    grouped.set(template.category, existing)
  }
  return Array.from(grouped.entries())
}

/* ==========================================================================
   Compact content helpers
   ========================================================================== */
function renderCompactSummary(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>,
  definitionsByKind: Map<string, BlockDefinition>
): string {
  const display = resolveDisplayConfig(block, libraryById, definitionsByKind)
  if (!display) return definitionsByKind.get(block.kind)?.name ?? block.kind

  const detail = getDisplayDetail(block, display.detailSource)
  if (!detail) return display.label

  const formatted = display.quoteDetail ? `'${detail}'` : detail
  if (display.label.length === 0 || display.detailSource === 'code') return formatted

  return `${display.label}${display.separator ?? ': '}${formatted}`
}

function resolveDisplayConfig(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>,
  definitionsByKind: Map<string, BlockDefinition>
): BlockDisplayConfig | null {
  if (block.templateId) {
    const templateDisplay = libraryById.get(block.templateId)?.display
    if (templateDisplay) return templateDisplay
  }
  return definitionsByKind.get(block.kind)?.display ?? null
}

function getDisplayDetail(block: TestBlock, source: BlockDisplayConfig['detailSource']): string {
  switch (source) {
    case 'url':           return getStringValue(block.values['url'])
    case 'value':         return getStringValue(block.values['value'])
    case 'title':         return getStringValue(block.values['title'])
    case 'text':          return getStringValue(block.values['text'])
    case 'definitions':   return summariseRawCode(getStringValue(block.values['definitions']))
    case 'selector.value': return getSelectorValue(block.values['selector'])?.value ?? ''
    case 'selector.name':  return getSelectorValue(block.values['selector'])?.name ?? getSelectorValue(block.values['selector'])?.varName ?? getSelectorValue(block.values['selector'])?.value ?? ''
    case 'test.title':    return getTestReferenceValue(block.values['target'])?.testTitle ?? ''
    case 'code':          return summariseRawCode(getStringValue(block.values['code']))
  }
}

function summariseRawCode(code: string): string {
  const compact = code.replace(/\s+/g, ' ').trim()
  return compact.length > 90 ? `${compact.slice(0, 87)}…` : compact
}

function createUniqueBlockTitle(base: string, existingBlocks: TestBlock[]): string {
  const lowerTitles = new Set(existingBlocks.map((b) => b.title.trim().toLowerCase()))
  let attempt = 1
  let candidate = base
  while (lowerTitles.has(candidate.toLowerCase())) {
    attempt += 1
    candidate = `${base} ${attempt}`
  }
  return candidate
}

/* ==========================================================================
   Code preview (unchanged logic)
   ========================================================================== */
function renderDocumentPreview(
  document: TestEditorDocument,
  definitionsByKind: Map<string, BlockDefinition>
): string {
  const body = renderDocumentBodyPreview(document, definitionsByKind)
  const args = [quoteString(document.testTitle), ...document.template.extraArgs]
  const callback = renderCallbackPreview(document.template, body)
  args.push(callback)
  return `${document.template.callee}(${args.join(', ')})`
}

function renderDocumentBodyPreview(
  document: Pick<TestEditorDocument, 'flowInputs' | 'blocks' | 'constants'>,
  definitionsByKind: Map<string, BlockDefinition>
): string {
  const constants = document.constants ?? []
  const body = document.blocks.map((block) => renderBlockPreview(block, definitionsByKind, '  ', constants)).join('\n')
  const flowPrelude = renderFlowPreludePreview(document.flowInputs)
  if (flowPrelude && body) return `${flowPrelude}\n${body}`
  return flowPrelude || body
}

function renderCallbackPreview(documentTemplate: TestEditorDocument['template'], body: string): string {
  const asyncPrefix = documentTemplate.callbackAsync ? 'async ' : ''
  const params = documentTemplate.callbackParams.trim()
  if (documentTemplate.callbackStyle === 'function') {
    return `${asyncPrefix}function(${params}) {\n${body}${body ? '\n' : ''}}`
  }
  return `${asyncPrefix}(${params}) => {\n${body}${body ? '\n' : ''}}`
}

function renderBlockPreview(
  block: TestBlock,
  definitionsByKind: Map<string, BlockDefinition>,
  indent: string,
  constants: string[] = []
): string {
  const titleComment = ` // ${sanitiseBlockTitle(block.title)}`
  const tv = (v: string): string => renderTemplateValuePreview(v, constants)
  const sel = (s: SelectorSpec | null): string => renderSelectorPreview(s, constants)
  const raw = (() => {
    switch (block.kind) {
      case 'constants_group':
        return getStringValue(block.values['definitions']).trim()
      case 'goto_url':
        return `await page.goto(${tv(getStringValue(block.values['url']))});${titleComment}`
      case 'click_element':
        return `await ${sel(getSelectorValue(block.values['selector']))}.click();${titleComment}`
      case 'fill_field':
        return `await ${sel(getSelectorValue(block.values['selector']))}.fill(${tv(getStringValue(block.values['value']))});${titleComment}`
      case 'expect_url':
        return `await expect(page).toHaveURL(${tv(getStringValue(block.values['url']))});${titleComment}`
      case 'expect_visible':
        return `await expect(${sel(getSelectorValue(block.values['selector']))}).toBeVisible();${titleComment}`
      case 'press_key':
        return `await ${sel(getSelectorValue(block.values['selector']))}.press(${tv(getStringValue(block.values['key']))});${titleComment}`
      case 'select_option':
        return `await ${sel(getSelectorValue(block.values['selector']))}.selectOption(${tv(getStringValue(block.values['value']))});${titleComment}`
      case 'use_subflow': {
        const target = getTestReferenceValue(block.values['target'])
        const stepTitle = getStringValue(block.values['stepTitle']) || target?.testTitle || 'Run subflow'
        const inputMappings = getFlowInputMappings(block.values['inputMappings'])
        const metadata = JSON.stringify({ target: target ?? { filePath: '', ordinal: 0, testTitle: '' }, inputMappings })
        return [
          `await test.step(${tv(stepTitle)}, async () => {`,
          `  // pw-studio-subflow: ${metadata}`,
          '  // The selected subflow is expanded when the document is saved.',
          `});${titleComment}`,
        ].join('\n')
      }
      case 'raw_code': {
        const code = getStringValue(block.values['code'])
        if (code.trim().length === 0) return `// ${sanitiseBlockTitle(block.title)}`
        return `// ${sanitiseBlockTitle(block.title)}\n${code}`
      }
      case 'set_checked': {
        const action = getStringValue(block.values['action']) === 'uncheck' ? 'uncheck' : 'check'
        return `await ${sel(getSelectorValue(block.values['selector']))}.${action}();${titleComment}`
      }
      case 'expect_contains_text':
        return `await expect(${sel(getSelectorValue(block.values['selector']))}).toContainText(${tv(getStringValue(block.values['text']))});${titleComment}`
      case 'expect_value':
        return `await expect(${sel(getSelectorValue(block.values['selector']))}).toHaveValue(${tv(getStringValue(block.values['value']))});${titleComment}`
      case 'expect_checked': {
        const isChecked = getStringValue(block.values['checked']) !== 'unchecked'
        return isChecked
          ? `await expect(${sel(getSelectorValue(block.values['selector']))}).toBeChecked();${titleComment}`
          : `await expect(${sel(getSelectorValue(block.values['selector']))}).not.toBeChecked();${titleComment}`
      }
      case 'check_element':
        return `await ${sel(getSelectorValue(block.values['selector']))}.check();${titleComment}`
      case 'uncheck_element':
        return `await ${sel(getSelectorValue(block.values['selector']))}.uncheck();${titleComment}`
      case 'expect_title': {
        const titleVal = getStringValue(block.values['title'])
        return `await expect(page).toHaveTitle(${tv(titleVal)});${titleComment}`
      }
      case 'expect_text':
        return `await expect(${sel(getSelectorValue(block.values['selector']))}).toHaveText(${tv(getStringValue(block.values['text']))});${titleComment}`
      case 'mx_click_row_cell':
        return `await mx.clickRowCell(${getStringValue(block.values['scope']) || 'page'}, { valueHint: ${tv(getStringValue(block.values['value']))}, container: ${tv(getStringValue(block.values['container']) || 'auto')}, confidence: ${tv(getStringValue(block.values['confidence']) || 'medium')} });${titleComment}`
      default:
        return `// Unsupported block: ${definitionsByKind.get(block.kind)?.name ?? block.kind}`
    }
  })()

  return raw.split('\n').map((line) => `${indent}${line}`).join('\n')
}

function renderSelectorPreview(selector: SelectorSpec | null, constants: string[] = []): string {
  if (!selector) return `page.locator('')`
  if (selector.varName) return selector.varName
  const tv = (v: string): string => renderTemplateValuePreview(v, constants)
  switch (selector.strategy) {
    case 'role':
      if (selector.name && selector.name.trim().length > 0) {
        return `page.getByRole(${tv(selector.value)}, { name: ${tv(selector.name)} })`
      }
      return `page.getByRole(${tv(selector.value)})`
    case 'text':        return `page.getByText(${tv(selector.value)})`
    case 'label':       return `page.getByLabel(${tv(selector.value)})`
    case 'test_id':     return `page.getByTestId(${tv(selector.value)})`
    case 'placeholder': return `page.getByPlaceholder(${tv(selector.value)})`
    case 'css':         return `page.locator(${tv(selector.value)})`
  }
}

function renderFlowPreludePreview(flowInputs: FlowInputDefinition[]): string {
  if (flowInputs.length === 0) return ''
  const defaultEntries = flowInputs.map((i) => `  ${i.name}: ${quoteString(i.defaultValue)},`).join('\n')
  const exposed = flowInputs.filter((i) => i.exposeAtRunStart).map((i) => quoteString(i.name)).join(', ')
  return [
    'function __pwResolveFlowInputs(defaults, _exposedAtRunStart, rawOverrides) {',
    '  if (!rawOverrides) { return defaults }',
    '  try {',
    '    const parsed = JSON.parse(rawOverrides)',
    "    const overrides = Object.fromEntries(Object.entries(parsed ?? {}).filter((entry) => typeof entry[0] === 'string' && typeof entry[1] === 'string'))",
    '    return { ...defaults, ...overrides }',
    '  } catch { return defaults }',
    '}',
    'const __pwFlowDefaults = {',
    defaultEntries,
    '};',
    `const __pwFlowExposed = [${exposed}];`,
    'const __pwFlow = __pwResolveFlowInputs(__pwFlowDefaults, __pwFlowExposed, process.env.PW_STUDIO_FLOW_INPUTS);',
  ].join('\n')
}

function renderTemplateValuePreview(value: string, constants: string[] = []): string {
  if (!/{{\s*[A-Za-z_][A-Za-z0-9_]*\s*}}/.test(value)) return quoteString(value)

  // If the entire value is a single constant reference, render as a bare identifier.
  const soloMatch = value.match(/^{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}$/)
  if (soloMatch?.[1] && constants.includes(soloMatch[1])) {
    return soloMatch[1]
  }

  let output = '`'
  let cursor = 0
  const matches = Array.from(value.matchAll(/{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g))
  for (const match of matches) {
    const index = match.index ?? 0
    const name = match[1] ?? ''
    output += escapeTemplateSegment(value.slice(cursor, index))
    output += constants.includes(name) ? `\${${name}}` : `\${__pwFlow.${name}}`
    cursor = index + match[0].length
  }
  output += escapeTemplateSegment(value.slice(cursor))
  output += '`'
  return output
}

function escapeTemplateSegment(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

/* ==========================================================================
   Utility helpers
   ========================================================================== */
function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (item === undefined) return items
  next.splice(toIndex, 0, item)
  return next
}

function getStringValue(value: BlockFieldValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

function getSelectorValue(value: BlockFieldValue | undefined): SelectorSpec | null {
  if (!value || typeof value !== 'object') return null
  if ('strategy' in value && 'value' in value) return value as SelectorSpec
  return null
}

function getTestReferenceValue(value: BlockFieldValue | undefined): TestReferenceSpec | null {
  if (!value || typeof value !== 'object') return null
  if ('filePath' in value && 'ordinal' in value && 'testTitle' in value) return value as TestReferenceSpec
  return null
}

function getFlowInputMappings(value: BlockFieldValue | undefined): FlowInputMapping[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is FlowInputMapping => {
    if (!entry || typeof entry !== 'object') return false
    return (
      'targetName' in entry &&
      'source' in entry &&
      'value' in entry &&
      typeof entry.targetName === 'string' &&
      (entry.source === 'flow_input' || entry.source === 'literal') &&
      typeof entry.value === 'string'
    )
  })
}

function quoteString(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n')}'`
}

function sanitiseBlockTitle(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

/* ==========================================================================
   Constants editor helpers
   ========================================================================== */
type ConstantEntry = { name: string; value: string }

function parseConstantDefinitions(value: string): ConstantEntry[] {
  const lines = value.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return [{ name: '', value: "''" }]
  return lines.map((line) => {
    const match = line.match(/^const\s+([A-Za-z_$][\w$]*)(?:\s*:\s*[^=;]+)?\s*=\s*(.+?);?$/)
    if (!match) return { name: '', value: line }
    return { name: match[1] ?? '', value: (match[2] ?? '').trim() }
  })
}

function serializeConstantDefinitions(entries: ConstantEntry[]): string {
  return entries
    .filter((e) => e.name.trim().length > 0 || e.value.trim().length > 0)
    .map((e) => `const ${e.name.trim()} = ${e.value.trim()};`)
    .join('\n')
}
