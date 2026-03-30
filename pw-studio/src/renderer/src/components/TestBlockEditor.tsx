import { useEffect, useMemo, useState } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type {
  AvailableTestCase,
  BlockDefinition,
  BlockDisplayConfig,
  BlockFieldSchema,
  BlockFieldValue,
  BlockTemplate,
  FlowInputDefinition,
  FlowInputMapping,
  IpcEnvelope,
  ManagedBlockTemplate,
  SelectorSpec,
  TestBlock,
  TestBlockTemplate,
  TestCaseRef,
  TestEditorDocument,
  TestEditorLibraryPayload,
  TestEditorMode,
  TestReferenceSpec,
} from '../../../shared/types/ipc'
import { api } from '../api/client'
import { CodeEditor } from './CodeEditor'
import { ErrorBanner } from './ErrorBanner'

type DragState =
  | { type: 'block'; index: number }
  | { type: 'template'; template: BlockTemplate }
  | null

type EditorTab = 'blocks' | 'code'
type BlockPanelMode = 'display' | 'edit'

type TestBlockEditorProps = {
  projectId: string
  mode: TestEditorMode
  filePath: string
  testCaseRef?: TestCaseRef
  onSaved: (document: TestEditorDocument) => void
  onCancelCreate?: () => void
  onRun?: () => void
  onRunWithOptions?: () => void
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
}: TestBlockEditorProps): JSX.Element {
  const [document, setDocument] = useState<TestEditorDocument | null>(null)
  const [savedDocument, setSavedDocument] = useState<TestEditorDocument | null>(null)
  const [codeDraft, setCodeDraft] = useState('')
  const [codeDirty, setCodeDirty] = useState(false)
  const [definitions, setDefinitions] = useState<BlockDefinition[]>([])
  const [library, setLibrary] = useState<ManagedBlockTemplate[]>([])
  const [availableTemplateIds, setAvailableTemplateIds] = useState<string[]>([])
  const [availableTestCases, setAvailableTestCases] = useState<AvailableTestCase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncingCode, setSyncingCode] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [tab, setTab] = useState<EditorTab>('blocks')
  const [blockPanelMode, setBlockPanelMode] = useState<BlockPanelMode>('display')
  const [dragState, setDragState] = useState<DragState>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [codeNotice, setCodeNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadEditor = async (): Promise<void> => {
      setLoading(true)
      setError(null)
      setCodeNotice(null)
      setTab('blocks')
      setBlockPanelMode('display')

      const [libraryResult, documentResult] = await Promise.all([
        api.invoke<TestEditorLibraryPayload>(IPC.TEST_EDITOR_LIBRARY, { projectId }),
        api.invoke<TestEditorDocument>(IPC.TEST_EDITOR_LOAD, {
          projectId,
          filePath,
          mode,
          testCaseRef,
        }),
      ])

      if (cancelled) {
        return
      }

      const libraryEnvelope = libraryResult as IpcEnvelope<TestEditorLibraryPayload>
      if (libraryEnvelope.payload) {
        setDefinitions(libraryEnvelope.payload.definitions)
        setLibrary(libraryEnvelope.payload.templates)
        setAvailableTemplateIds(libraryEnvelope.payload.availableTemplateIds)
        setAvailableTestCases(libraryEnvelope.payload.availableTestCases)
      }

      const documentEnvelope = documentResult as IpcEnvelope<TestEditorDocument>
      if (documentEnvelope.error) {
        setError(documentEnvelope.error)
        setLoading(false)
        return
      }

      if (documentEnvelope.payload) {
        setDocument(documentEnvelope.payload)
        setSavedDocument(documentEnvelope.payload)
        setCodeDraft(documentEnvelope.payload.code)
        setCodeDirty(false)
      }

      setLoading(false)
    }

    void loadEditor()

    return () => {
      cancelled = true
    }
  }, [filePath, mode, projectId, testCaseRef?.ordinal, testCaseRef?.testTitle])

  const isDirty = useMemo(() => {
    if (!document || !savedDocument) {
      return false
    }

    return JSON.stringify(document) !== JSON.stringify(savedDocument) || codeDirty
  }, [codeDirty, document, savedDocument])

  const availableLibrary = useMemo(
    () => library.filter((template) => availableTemplateIds.includes(template.id)),
    [availableTemplateIds, library]
  )
  const selectableTestCases = useMemo(() => {
    return availableTestCases.filter((entry) => {
      if (mode !== 'existing' || !testCaseRef) {
        return true
      }

      const normalisedCurrent = filePath.replace(/\\/g, '/')
      const normalisedEntry = entry.filePath.replace(/\\/g, '/')
      const sameFile =
        normalisedCurrent === normalisedEntry || normalisedCurrent.endsWith(`/${normalisedEntry}`)

      return !(sameFile && entry.ordinal === testCaseRef.ordinal)
    })
  }, [availableTestCases, filePath, mode, testCaseRef])
  const libraryGroups = useMemo(() => groupLibraryByCategory(availableLibrary), [availableLibrary])
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
      if (!current) {
        return current
      }

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
    if (!document) {
      return null
    }

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

    if (!envelope.payload) {
      return null
    }

    setDocument(envelope.payload)
    setSavedDocument((current) => current)
    setCodeDraft(envelope.payload.code)
    setCodeDirty(false)
    setCodeNotice(null)
    return envelope.payload
  }

  const handleSave = async (): Promise<void> => {
    if (!document) {
      return
    }

    let toSave = document
    if (tab === 'code' && codeDirty) {
      const synced = await handleApplyCodeToBlocks()
      if (!synced) {
        return
      }
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

    if (envelope.error) {
      setError(envelope.error)
      return
    }

    if (!envelope.payload) {
      return
    }

    setDocument(envelope.payload)
    setSavedDocument(envelope.payload)
    setCodeDraft(envelope.payload.code)
    setCodeDirty(false)
    setCodeNotice(null)
    onSaved(envelope.payload)
  }

  const handleDiscard = (): void => {
    if (!savedDocument) {
      return
    }

    setDocument(savedDocument)
    setCodeDraft(savedDocument.code)
    setCodeDirty(false)
    setCodeNotice(null)
    setError(null)
  }

  const applyDrop = (targetIndex: number): void => {
    if (!document || !dragState) {
      return
    }

    updateDocument(
      (current) => {
        const nextBlocks = [...current.blocks]

        if (dragState.type === 'block') {
          const [moved] = nextBlocks.splice(dragState.index, 1)
          if (!moved) {
            return current
          }
          const insertIndex = dragState.index < targetIndex ? targetIndex - 1 : targetIndex
          nextBlocks.splice(insertIndex, 0, moved)
        } else {
          nextBlocks.splice(
            targetIndex,
            0,
            createBlockFromTemplate(dragState.template.block, nextBlocks, definitionsByKind, dragState.template.id)
          )
        }

        return {
          ...current,
          blocks: nextBlocks,
        }
      },
      codeDirty
        ? { keepCodeDraft: true, notice: 'The code tab has unsynced edits. Apply code to blocks or discard them to refresh the generated code preview.' }
        : undefined
    )

    setDragState(null)
    setDropIndex(null)
  }

  if (loading) {
    return <div className="code-loading">Loading visual editor...</div>
  }

  if (!document) {
    return (
      <div className="detail-info-content">
        {error ? <ErrorBanner code={error.code} message={error.message} /> : <p>Unable to load the visual test editor.</p>}
      </div>
    )
  }

  return (
    <div className="test-editor">
      <div className="test-editor-header">
        <div className="test-editor-title-group">
          <span className="test-editor-label">Test title</span>
          <input
            className="test-editor-title-input"
            value={document.testTitle}
            onChange={(event) => {
              const nextTitle = event.target.value
              updateDocument(
                (current) => ({
                  ...current,
                  testTitle: nextTitle,
                }),
                codeDirty
                  ? { keepCodeDraft: true, notice: 'The code tab has unsynced edits. Save from the code tab to keep them.' }
                  : undefined
              )
            }}
          />
          <span className="test-editor-path">{document.filePath}</span>
        </div>
        <div className="test-editor-action-row">
          {mode === 'existing' && onRun && (
            <button className="btn btn-primary btn-sm" onClick={onRun}>
              {'\u25B6'} Run Test
            </button>
          )}
          {mode === 'existing' && onRunWithOptions && (
            <button className="btn btn-secondary btn-sm" onClick={onRunWithOptions}>
              Run with Options...
            </button>
          )}
          {mode === 'create' && onCancelCreate && (
            <button className="btn btn-secondary btn-sm" onClick={onCancelCreate}>
              Cancel
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleDiscard} disabled={!isDirty || saving || syncingCode}>
            Discard
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => void handleSave()} disabled={saving || syncingCode}>
            {saving ? 'Saving...' : mode === 'create' ? 'Create Test' : 'Save'}
          </button>
        </div>
      </div>

      <div className="detail-tabs">
        <button className={`tab-btn ${tab === 'blocks' ? 'active' : ''}`} onClick={() => setTab('blocks')}>
          Blocks {isDirty && tab === 'blocks' && <span className="dirty-dot" />}
        </button>
        <button className={`tab-btn ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>
          Code {(codeDirty || (isDirty && tab === 'code')) && <span className="dirty-dot" />}
        </button>
      </div>

      {error && <ErrorBanner code={error.code} message={error.message} />}
      {document.warnings.length > 0 && (
        <div className="warning-banner">
          {document.warnings.join(' ')}
        </div>
      )}
      {codeNotice && (
        <div className="warning-banner">
          {codeNotice}
        </div>
      )}

      {tab === 'blocks' ? (
        <>
          <div className="test-editor-blocks-toolbar">
            <div className="test-editor-mode-toggle">
              <button
                className={`test-editor-mode-btn ${blockPanelMode === 'display' ? 'active' : ''}`}
                onClick={() => setBlockPanelMode('display')}
              >
                Display
              </button>
              <button
                className={`test-editor-mode-btn ${blockPanelMode === 'edit' ? 'active' : ''}`}
                onClick={() => setBlockPanelMode('edit')}
              >
                Edit
              </button>
            </div>
          </div>

        <div className={`test-editor-layout ${blockPanelMode === 'display' ? 'display-mode' : ''}`}>
          <div className="test-editor-main-column">
            <div className="test-editor-flow-inputs-panel">
              <FlowInputsEditor
                mode={blockPanelMode}
                flowInputs={document.flowInputs}
                onChange={(flowInputs) =>
                  updateDocument(
                    (current) => ({
                      ...current,
                      flowInputs,
                    }),
                    codeDirty
                      ? { keepCodeDraft: true, notice: 'The code tab has unsynced edits. Save from the code tab to keep them.' }
                      : undefined
                  )
                }
              />
            </div>

            <div className="test-editor-canvas">
              <div className="test-editor-panel-title">
                Visual steps
              </div>
              {blockPanelMode === 'edit' && (
                <DropZone
                  active={dropIndex === 0}
                  onDragOver={() => setDropIndex(0)}
                  onDrop={() => applyDrop(0)}
                />
              )}
              {document.blocks.length === 0 ? (
                <div
                  className="test-editor-empty"
                  onDragOver={(event) => {
                    if (blockPanelMode !== 'edit') {
                      return
                    }
                    event.preventDefault()
                    setDropIndex(0)
                  }}
                  onDrop={(event) => {
                    if (blockPanelMode !== 'edit') {
                      return
                    }
                    event.preventDefault()
                    applyDrop(0)
                  }}
                >
                  {blockPanelMode === 'edit' ? 'Drag blocks here to build the test.' : 'No visual steps yet.'}
                </div>
              ) : (
                document.blocks.map((block, index) => (
                  <div key={block.id}>
                    <div className="test-editor-flow-row">
                      <div className="test-editor-flow-dot" />
                      <div
                        className={`test-editor-block ${blockPanelMode === 'display' ? 'compact' : 'expanded'}`}
                        draggable={blockPanelMode === 'edit'}
                        onDragStart={(event) => {
                          if (blockPanelMode !== 'edit') {
                            event.preventDefault()
                            return
                          }
                          event.dataTransfer.effectAllowed = 'move'
                          setDragState({ type: 'block', index })
                        }}
                        onDragEnd={() => {
                          setDragState(null)
                          setDropIndex(null)
                        }}
                      >
                        <div className="test-editor-block-header">
                          <div className="test-editor-block-copy">
                            {shouldShowCompactTitle(block, libraryById, definitionsByKind) && (
                              <div className="test-editor-block-title">{block.title}</div>
                            )}
                            {renderCompactContent(block, libraryById, definitionsByKind)}
                          </div>
                          {blockPanelMode === 'edit' && (
                            <div className="test-editor-block-actions">
                              <button
                                className="test-editor-icon-btn"
                                title="Delete block"
                                onClick={() =>
                                  updateDocument(
                                    (current) => ({
                                      ...current,
                                      blocks: current.blocks.filter((entry) => entry.id !== block.id),
                                    }),
                                    codeDirty
                                      ? { keepCodeDraft: true, notice: 'The code tab has unsynced edits. Save from the code tab to keep them.' }
                                      : undefined
                                  )
                                }
                              >
                                {'\u{1F5D1}'}
                              </button>
                            </div>
                          )}
                        </div>
                        {blockPanelMode === 'edit' && (
                          <BlockFields
                            block={block}
                            definition={definitionsByKind.get(block.kind)}
                            flowInputs={document.flowInputs}
                            availableTestCases={selectableTestCases}
                            onChange={(nextBlock) =>
                              updateDocument(
                                (current) => ({
                                  ...current,
                                  blocks: current.blocks.map((entry) => (entry.id === block.id ? nextBlock : entry)),
                                }),
                                codeDirty
                                  ? { keepCodeDraft: true, notice: 'The code tab has unsynced edits. Save from the code tab to keep them.' }
                                  : undefined
                              )
                            }
                          />
                        )}
                      </div>
                    </div>
                    {blockPanelMode === 'edit' && (
                      <DropZone
                        active={dropIndex === index + 1}
                        onDragOver={() => setDropIndex(index + 1)}
                        onDrop={() => applyDrop(index + 1)}
                      />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {blockPanelMode === 'edit' && (
            <div className="test-editor-library">
              <div className="test-editor-panel-title">Block library</div>
              <div className="test-editor-library-list">
                {libraryGroups.map(([category, entries]) => (
                  <div key={category} className="test-editor-library-group">
                    <div className="test-editor-library-heading">{category}</div>
                    {entries.map((template) => (
                      <button
                        key={template.id}
                        className="test-editor-library-item"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'copyMove'
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
                        <span className="test-editor-library-name">{template.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </>
      ) : (
        <div className="test-editor-code-tab">
          <div className="test-editor-code-actions">
            <span className="test-editor-code-hint">
              This code is the saved source-of-truth that PW Studio will execute.
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => void handleApplyCodeToBlocks()} disabled={syncingCode}>
              {syncingCode ? 'Applying...' : 'Apply Code to Blocks'}
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
      return {
        ...current,
        blocks: nextBlocks,
      }
    },
    codeDirty
      ? { keepCodeDraft: true, notice: 'The code tab has unsynced edits. Save from the code tab to keep them.' }
      : undefined
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

function shouldShowCompactTitle(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>,
  definitionsByKind: Map<string, BlockDefinition>
): boolean {
  return !resolveDisplayConfig(block, libraryById, definitionsByKind)?.hideTitle
}

function renderCompactSummary(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>,
  definitionsByKind: Map<string, BlockDefinition>
): string {
  const display = resolveDisplayConfig(block, libraryById, definitionsByKind)
  if (!display) {
    return definitionsByKind.get(block.kind)?.name ?? block.kind
  }

  const detail = getDisplayDetail(block, display.detailSource)
  if (!detail) {
    return display.label
  }

  const formatted = display.quoteDetail ? `'${detail}'` : detail
  if (display.label.length === 0 || display.detailSource === 'code') {
    return formatted
  }

  return `${display.label}${display.separator ?? ': '}${formatted}`
}

function renderCompactContent(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>,
  definitionsByKind: Map<string, BlockDefinition>
): JSX.Element {
  if (block.kind === 'constants_group') {
    const definitions = parseConstantDefinitions(getStringValue(block.values['definitions']))
    return (
      <div className="test-editor-constants-display-list">
        {definitions.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="test-editor-constants-display-row">
            <span className="test-editor-constants-display-name">{entry.name}</span>
            <span className="test-editor-constants-display-separator">:</span>
            <span className="test-editor-constants-display-value">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="test-editor-block-subtitle">
      {renderCompactSummary(block, libraryById, definitionsByKind)}
    </div>
  )
}

function resolveDisplayConfig(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>,
  definitionsByKind: Map<string, BlockDefinition>
): BlockDisplayConfig | null {
  if (block.templateId) {
    const templateDisplay = libraryById.get(block.templateId)?.display
    if (templateDisplay) {
      return templateDisplay
    }
  }

  return definitionsByKind.get(block.kind)?.display ?? null
}

function getDisplayDetail(block: TestBlock, source: BlockDisplayConfig['detailSource']): string {
  switch (source) {
    case 'url':
      return getStringValue(block.values['url'])
    case 'value':
      return getStringValue(block.values['value'])
    case 'definitions':
      return summariseRawCode(getStringValue(block.values['definitions']))
    case 'selector.value':
      return getSelectorValue(block.values['selector'])?.value ?? ''
    case 'selector.name':
      return getSelectorValue(block.values['selector'])?.name ?? getSelectorValue(block.values['selector'])?.value ?? ''
    case 'test.title':
      return getTestReferenceValue(block.values['target'])?.testTitle ?? ''
    case 'code':
      return summariseRawCode(getStringValue(block.values['code']))
  }
}

function summariseRawCode(code: string): string {
  const compact = code.replace(/\s+/g, ' ').trim()
  return compact.length > 90 ? `${compact.slice(0, 87)}...` : compact
}

function createUniqueBlockTitle(base: string, existingBlocks: TestBlock[]): string {
  const lowerTitles = new Set(existingBlocks.map((block) => block.title.trim().toLowerCase()))
  let attempt = 1
  let candidate = base

  while (lowerTitles.has(candidate.toLowerCase())) {
    attempt += 1
    candidate = `${base} ${attempt}`
  }

  return candidate
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

function FlowInputsEditor({
  mode,
  flowInputs,
  onChange,
}: {
  mode: BlockPanelMode
  flowInputs: FlowInputDefinition[]
  onChange: (flowInputs: FlowInputDefinition[]) => void
}): JSX.Element {
  const createInput = (): void => {
    const nextIndex = flowInputs.length + 1
    onChange([
      ...flowInputs,
      {
        id: crypto.randomUUID(),
        name: `Input${nextIndex}`,
        defaultValue: '',
        exposeAtRunStart: false,
      },
    ])
  }

  return (
    <div className="test-editor-flow-inputs">
      <div className="test-editor-panel-title test-editor-panel-title-row">
        <span>Flow inputs</span>
        {mode === 'edit' && (
          <button className="btn btn-secondary btn-sm" onClick={createInput}>
            Add Input
          </button>
        )}
      </div>
      {flowInputs.length === 0 ? (
        <div className="test-editor-flow-input-list" />
      ) : (
        <div className="test-editor-flow-input-list">
          {mode === 'display'
            ? flowInputs.map((input) => (
                <div key={input.id} className="test-editor-flow-input-display-row">
                  <span className="test-editor-flow-input-display-name">{input.name}</span>
                  <span className="test-editor-flow-input-display-separator">:</span>
                  <span className="test-editor-flow-input-display-value">
                    {input.defaultValue || '(empty)'}
                  </span>
                </div>
              ))
            : flowInputs.map((input, index) => (
                <div key={input.id} className="test-editor-flow-input-row">
                  <input
                    className="test-editor-flow-input-name"
                    value={input.name}
                    onChange={(event) =>
                      onChange(
                        flowInputs.map((entry) =>
                          entry.id === input.id
                            ? { ...entry, name: event.target.value }
                            : entry
                        )
                      )
                    }
                    placeholder="Name"
                  />
                  <input
                    className="test-editor-flow-input-value"
                    value={input.defaultValue}
                    onChange={(event) =>
                      onChange(
                        flowInputs.map((entry) =>
                          entry.id === input.id
                            ? { ...entry, defaultValue: event.target.value }
                            : entry
                        )
                      )
                    }
                    placeholder="Default value"
                  />
                  <label className="test-editor-flow-input-toggle">
                    <input
                      type="checkbox"
                      checked={input.exposeAtRunStart}
                      onChange={(event) =>
                        onChange(
                          flowInputs.map((entry) =>
                            entry.id === input.id
                              ? { ...entry, exposeAtRunStart: event.target.checked }
                              : entry
                          )
                        )
                      }
                    />
                    Run start
                  </label>
                  <div className="test-editor-flow-input-actions">
                    <button
                      className="test-editor-icon-btn"
                      title="Move up"
                      disabled={index === 0}
                      onClick={() => onChange(moveArrayItem(flowInputs, index, index - 1))}
                    >
                      {'\u2191'}
                    </button>
                    <button
                      className="test-editor-icon-btn"
                      title="Move down"
                      disabled={index === flowInputs.length - 1}
                      onClick={() => onChange(moveArrayItem(flowInputs, index, index + 1))}
                    >
                      {'\u2193'}
                    </button>
                    <button
                      className="test-editor-icon-btn"
                      title="Delete input"
                      onClick={() => onChange(flowInputs.filter((entry) => entry.id !== input.id))}
                    >
                      {'\u{1F5D1}'}
                    </button>
                  </div>
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

function BlockFields({
  block,
  definition,
  flowInputs,
  availableTestCases,
  onChange,
}: {
  block: TestBlock
  definition?: BlockDefinition
  flowInputs: FlowInputDefinition[]
  availableTestCases: AvailableTestCase[]
  onChange: (block: TestBlock) => void
}): JSX.Element {
  if (!definition) {
    return <p className="detail-muted">No editor definition is available for this block kind.</p>
  }

  return (
    <div className="test-editor-field-grid">
      {definition.fields.map((field) => (
        <FieldEditor
          key={field.key}
          block={block}
          field={field}
          value={block.values[field.key]}
          flowInputs={flowInputs}
          availableTestCases={availableTestCases}
          onChange={(value) =>
            onChange({
              ...block,
              values: {
                ...block.values,
                [field.key]: value,
              },
            })
          }
        />
      ))}
    </div>
  )
}

function FieldEditor({
  block,
  field,
  value,
  flowInputs,
  availableTestCases,
  onChange,
}: {
  block: TestBlock
  field: BlockFieldSchema
  value: BlockFieldValue | undefined
  flowInputs: FlowInputDefinition[]
  availableTestCases: AvailableTestCase[]
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
          <textarea
            className="test-editor-raw-code"
            rows={field.rows ?? 4}
            placeholder={field.placeholder}
            value={getStringValue(value)}
            onChange={(event) => onChange(event.target.value)}
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
            onChange={(event) => onChange(event.target.value)}
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
            onChange={(event) => onChange(event.target.checked)}
          />
          {field.label}
        </label>
      )
    case 'selector':
      return (
        <SelectorEditor
          label={field.label}
          selector={getSelectorValue(value) ?? { strategy: 'role', value: 'button', name: '' }}
          flowInputs={flowInputs}
          onChange={onChange}
        />
      )
    case 'test_case':
      return (
        <TestCaseEditor
          label={field.label}
          value={getTestReferenceValue(value)}
          availableTestCases={availableTestCases}
          onChange={onChange}
        />
      )
    case 'flow_mapping':
      return (
        <FlowMappingEditor
          block={block}
          label={field.label}
          value={getFlowInputMappings(value)}
          flowInputs={flowInputs}
          availableTestCases={availableTestCases}
          onChange={onChange}
        />
      )
    case 'text':
    default:
      return (
        <label>
          {field.label}
          <FlowAwareTextInput
            placeholder={field.placeholder}
            value={getStringValue(value)}
            flowInputs={flowInputs}
            onChange={(nextValue) => onChange(nextValue)}
          />
        </label>
      )
  }
}

function ConstantsGroupEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}): JSX.Element {
  const entries = parseConstantDefinitions(value)

  const updateEntries = (nextEntries: ConstantEntry[]): void => {
    onChange(serializeConstantDefinitions(nextEntries))
  }

  return (
    <div className="test-editor-constants-editor">
      <div className="test-editor-constants-editor-header">
        <span className="test-editor-field-label">Constants</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => updateEntries([...entries, { name: '', value: "''" }])}
        >
          Add constant
        </button>
      </div>
      <div className="test-editor-constants-editor-list">
        {entries.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="test-editor-constants-editor-row">
            <input
              value={entry.name}
              placeholder="name"
              onChange={(event) =>
                updateEntries(
                  entries.map((current, currentIndex) =>
                    currentIndex === index ? { ...current, name: event.target.value } : current
                  )
                )
              }
            />
            <input
              value={entry.value}
              placeholder="'value'"
              onChange={(event) =>
                updateEntries(
                  entries.map((current, currentIndex) =>
                    currentIndex === index ? { ...current, value: event.target.value } : current
                  )
                )
              }
            />
            <button
              type="button"
              className="test-editor-icon-btn"
              title="Delete constant"
              onClick={() => updateEntries(entries.filter((_, currentIndex) => currentIndex !== index))}
            >
              {'\u{1F5D1}'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SelectorEditor({
  label,
  selector,
  flowInputs,
  onChange,
}: {
  label: string
  selector: SelectorSpec
  flowInputs: FlowInputDefinition[]
  onChange: (selector: SelectorSpec) => void
}): JSX.Element {
  return (
    <div className="test-editor-selector-grid">
      <label>
        {label}
        <select
          className="form-select"
          value={selector.strategy}
          onChange={(event) => {
            const nextStrategy = event.target.value as SelectorSpec['strategy']
            onChange({
              strategy: nextStrategy,
              value: nextStrategy === 'role' ? 'button' : '',
              name: nextStrategy === 'role' ? '' : undefined,
            })
          }}
        >
          <option value="role">Role</option>
          <option value="text">Text</option>
          <option value="label">Label</option>
          <option value="placeholder">Placeholder</option>
          <option value="test_id">Test ID</option>
          <option value="css">CSS</option>
        </select>
      </label>

      {selector.strategy === 'role' ? (
        <>
          <label>
            Role
            <FlowAwareTextInput
              value={selector.value}
              flowInputs={flowInputs}
              onChange={(nextValue) => onChange({ ...selector, value: nextValue })}
            />
          </label>
          <label>
            Accessible name
            <FlowAwareTextInput
              value={selector.name ?? ''}
              flowInputs={flowInputs}
              onChange={(nextValue) => onChange({ ...selector, name: nextValue })}
            />
          </label>
        </>
      ) : (
        <label>
          Value
          <FlowAwareTextInput
            value={selector.value}
            flowInputs={flowInputs}
            onChange={(nextValue) => onChange({ ...selector, value: nextValue })}
          />
        </label>
      )}
    </div>
  )
}

function FlowMappingEditor({
  block,
  label,
  value,
  flowInputs,
  availableTestCases,
  onChange,
}: {
  block: TestBlock
  label: string
  value: FlowInputMapping[]
  flowInputs: FlowInputDefinition[]
  availableTestCases: AvailableTestCase[]
  onChange: (value: BlockFieldValue) => void
}): JSX.Element {
  const target = getTestReferenceValue(block.values['target'])
  const targetCase = target
    ? availableTestCases.find(
        (entry) => entry.filePath === target.filePath && entry.ordinal === target.ordinal
      ) ?? null
    : null
  const childInputs = targetCase?.flowInputs ?? []

  if (!targetCase) {
    return (
      <div className="detail-muted">
        {label}: select a source test first to map inputs into the subflow.
      </div>
    )
  }

  if (childInputs.length === 0) {
    return <div className="detail-muted">{label}: the selected subflow has no flow inputs.</div>
  }

  const updateMapping = (
    targetName: string,
    nextSource: FlowInputMapping['source'] | 'default',
    nextValue: string
  ): void => {
    const remaining = value.filter((entry) => entry.targetName !== targetName)
    if (nextSource === 'default') {
      onChange(remaining)
      return
    }

    onChange([
      ...remaining,
      {
        targetName,
        source: nextSource,
        value: nextValue,
      },
    ])
  }

  return (
    <div className="test-editor-flow-mapping">
      <span className="test-editor-field-label">{label}</span>
      {childInputs.map((childInput) => {
        const mapping = value.find((entry) => entry.targetName === childInput.name)
        const source = mapping?.source ?? 'default'
        return (
          <div key={childInput.id} className="test-editor-flow-mapping-row">
            <div className="test-editor-flow-mapping-target">
              <strong>{childInput.name}</strong>
              <span className="detail-muted">Default: {childInput.defaultValue || '(empty)'}</span>
            </div>
            <select
              className="form-select"
              value={source}
              onChange={(event) =>
                updateMapping(
                  childInput.name,
                  event.target.value as FlowInputMapping['source'] | 'default',
                  mapping?.value ?? ''
                )
              }
            >
              <option value="default">Use child default</option>
              <option value="flow_input">Use parent flow input</option>
              <option value="literal">Use literal value</option>
            </select>
            {source === 'flow_input' ? (
              <select
                className="form-select"
                value={mapping?.value ?? ''}
                onChange={(event) => updateMapping(childInput.name, 'flow_input', event.target.value)}
              >
                <option value="">Select flow input</option>
                {flowInputs.map((input) => (
                  <option key={input.id} value={input.name}>
                    {input.name}
                  </option>
                ))}
              </select>
            ) : source === 'literal' ? (
              <input
                value={mapping?.value ?? ''}
                onChange={(event) => updateMapping(childInput.name, 'literal', event.target.value)}
                placeholder="Literal value"
              />
            ) : (
              <div className="detail-muted">Child default will be used.</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FlowAwareTextInput({
  value,
  flowInputs,
  placeholder,
  onChange,
}: {
  value: string
  flowInputs: FlowInputDefinition[]
  placeholder?: string
  onChange: (value: string) => void
}): JSX.Element {
  const insertPlaceholder = (name: string): void => {
    onChange(`${value}{{${name}}}`)
  }

  return (
    <div className="test-editor-flow-aware-input">
      <input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      {flowInputs.length > 0 && (
        <div className="test-editor-flow-placeholder-list">
          {flowInputs.map((input) => (
            <button
              key={input.id}
              type="button"
              className="test-editor-placeholder-chip"
              onClick={() => insertPlaceholder(input.name)}
              title={`Insert {{${input.name}}}`}
            >
              {input.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TestCaseEditor({
  label,
  value,
  availableTestCases,
  onChange,
}: {
  label: string
  value: TestReferenceSpec | null
  availableTestCases: AvailableTestCase[]
  onChange: (value: BlockFieldValue) => void
}): JSX.Element {
  const selectedKey = value ? `${value.filePath}::${value.ordinal}` : ''

  return (
    <label>
      {label}
      <select
        className="form-select"
        value={selectedKey}
        onChange={(event) => {
          const next = availableTestCases.find(
            (entry) => `${entry.filePath}::${entry.ordinal}` === event.target.value
          )
          onChange(
            next
              ? {
                  filePath: next.filePath,
                  ordinal: next.ordinal,
                  testTitle: next.testTitle,
                }
              : null
          )
        }}
      >
        <option value="">Select a test</option>
        {availableTestCases.map((entry) => (
          <option key={`${entry.filePath}::${entry.ordinal}`} value={`${entry.filePath}::${entry.ordinal}`}>
            {entry.label}
          </option>
        ))}
      </select>
    </label>
  )
}

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
      className={`test-editor-drop-zone ${active ? 'active' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop()
      }}
    />
  )
}

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
  document: Pick<TestEditorDocument, 'flowInputs' | 'blocks'>,
  definitionsByKind: Map<string, BlockDefinition>
): string {
  const body = document.blocks.map((block) => renderBlockPreview(block, definitionsByKind, '  ')).join('\n')
  const flowPrelude = renderFlowPreludePreview(document.flowInputs)

  if (flowPrelude && body) {
    return `${flowPrelude}\n${body}`
  }

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
  indent: string
): string {
  const titleComment = ` // ${sanitiseBlockTitle(block.title)}`
  const raw = (() => {
    switch (block.kind) {
      case 'constants_group':
        return getStringValue(block.values['definitions']).trim()
      case 'goto_url':
        return `await page.goto(${renderTemplateValuePreview(getStringValue(block.values['url']))});${titleComment}`
      case 'click_element':
        return `await ${renderSelectorPreview(getSelectorValue(block.values['selector']))}.click();${titleComment}`
      case 'fill_field':
        return `await ${renderSelectorPreview(getSelectorValue(block.values['selector']))}.fill(${renderTemplateValuePreview(getStringValue(block.values['value']))});${titleComment}`
      case 'expect_url':
        return `await expect(page).toHaveURL(${renderTemplateValuePreview(getStringValue(block.values['url']))});${titleComment}`
      case 'expect_visible':
        return `await expect(${renderSelectorPreview(getSelectorValue(block.values['selector']))}).toBeVisible();${titleComment}`
      case 'press_key':
        return `await ${renderSelectorPreview(getSelectorValue(block.values['selector']))}.press(${renderTemplateValuePreview(getStringValue(block.values['key']))});${titleComment}`
      case 'select_option':
        return `await ${renderSelectorPreview(getSelectorValue(block.values['selector']))}.selectOption(${renderTemplateValuePreview(getStringValue(block.values['value']))});${titleComment}`
      case 'use_subflow': {
        const target = getTestReferenceValue(block.values['target'])
        const stepTitle = getStringValue(block.values['stepTitle']) || target?.testTitle || 'Run subflow'
        const inputMappings = getFlowInputMappings(block.values['inputMappings'])
        const metadata = JSON.stringify(
          {
            target: target ?? {
              filePath: '',
              ordinal: 0,
              testTitle: '',
            },
            inputMappings,
          }
        )
        return [
          `await test.step(${renderTemplateValuePreview(stepTitle)}, async () => {`,
          `  // pw-studio-subflow: ${metadata}`,
          '  // The selected subflow is expanded when the document is saved.',
          `});${titleComment}`,
        ].join('\n')
      }
      case 'raw_code': {
        const code = getStringValue(block.values['code'])
        if (code.trim().length === 0) {
          return `// ${sanitiseBlockTitle(block.title)}`
        }
        return `// ${sanitiseBlockTitle(block.title)}\n${code}`
      }
      case 'mx_click_row_cell':
        return `await mx.clickRowCell(${getStringValue(block.values['scope']) || 'page'}, { valueHint: ${renderTemplateValuePreview(getStringValue(block.values['value']))}, container: ${renderTemplateValuePreview(getStringValue(block.values['container']) || 'auto')}, confidence: ${renderTemplateValuePreview(getStringValue(block.values['confidence']) || 'medium')} });${titleComment}`
      default:
        return `// Unsupported block: ${definitionsByKind.get(block.kind)?.name ?? block.kind}`
    }
  })()

  return raw
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n')
}

function renderSelectorPreview(selector: SelectorSpec | null): string {
  if (!selector) {
    return `page.locator('')`
  }

  switch (selector.strategy) {
    case 'role':
      if (selector.name && selector.name.trim().length > 0) {
        return `page.getByRole(${renderTemplateValuePreview(selector.value)}, { name: ${renderTemplateValuePreview(selector.name)} })`
      }
      return `page.getByRole(${renderTemplateValuePreview(selector.value)})`
    case 'text':
      return `page.getByText(${renderTemplateValuePreview(selector.value)})`
    case 'label':
      return `page.getByLabel(${renderTemplateValuePreview(selector.value)})`
    case 'test_id':
      return `page.getByTestId(${renderTemplateValuePreview(selector.value)})`
    case 'placeholder':
      return `page.getByPlaceholder(${renderTemplateValuePreview(selector.value)})`
    case 'css':
      return `page.locator(${renderTemplateValuePreview(selector.value)})`
  }
}

function getStringValue(value: BlockFieldValue | undefined): string {
  return typeof value === 'string' ? value : ''
}

function getSelectorValue(value: BlockFieldValue | undefined): SelectorSpec | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if ('strategy' in value && 'value' in value) {
    return value as SelectorSpec
  }

  return null
}

function getTestReferenceValue(value: BlockFieldValue | undefined): TestReferenceSpec | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if ('filePath' in value && 'ordinal' in value && 'testTitle' in value) {
    return value as TestReferenceSpec
  }

  return null
}

function getFlowInputMappings(value: BlockFieldValue | undefined): FlowInputMapping[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is FlowInputMapping => {
    if (!entry || typeof entry !== 'object') {
      return false
    }

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

function renderFlowPreludePreview(flowInputs: FlowInputDefinition[]): string {
  if (flowInputs.length === 0) {
    return ''
  }

  const defaultEntries = flowInputs
    .map((input) => `  ${input.name}: ${quoteString(input.defaultValue)},`)
    .join('\n')
  const exposed = flowInputs
    .filter((input) => input.exposeAtRunStart)
    .map((input) => quoteString(input.name))
    .join(', ')

  return [
    'function __pwResolveFlowInputs(defaults, _exposedAtRunStart, rawOverrides) {',
    '  if (!rawOverrides) {',
    '    return defaults',
    '  }',
    '',
    '  try {',
    '    const parsed = JSON.parse(rawOverrides)',
    "    const overrides = Object.fromEntries(Object.entries(parsed ?? {}).filter((entry) => typeof entry[0] === 'string' && typeof entry[1] === 'string'))",
    '    return { ...defaults, ...overrides }',
    '  } catch {',
    '    return defaults',
    '  }',
    '}',
    'const __pwFlowDefaults = {',
    defaultEntries,
    '};',
    `const __pwFlowExposed = [${exposed}];`,
    'const __pwFlow = __pwResolveFlowInputs(__pwFlowDefaults, __pwFlowExposed, process.env.PW_STUDIO_FLOW_INPUTS);',
  ].join('\n')
}

function renderTemplateValuePreview(value: string): string {
  if (!/{{\s*[A-Za-z_][A-Za-z0-9_]*\s*}}/.test(value)) {
    return quoteString(value)
  }

  let output = '`'
  let cursor = 0
  const matches = Array.from(value.matchAll(/{{\s*([A-Za-z_][A-Za-z0-9_]*)\s*}}/g))

  for (const match of matches) {
    const index = match.index ?? 0
    output += escapeTemplateSegment(value.slice(cursor, index))
    output += `\${__pwFlow.${match[1] ?? ''}}`
    cursor = index + match[0].length
  }

  output += escapeTemplateSegment(value.slice(cursor))
  output += '`'
  return output
}

function escapeTemplateSegment(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items
  }

  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  if (item === undefined) {
    return items
  }
  next.splice(toIndex, 0, item)
  return next
}

type ConstantEntry = {
  name: string
  value: string
}

function parseConstantDefinitions(value: string): ConstantEntry[] {
  const lines = value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length === 0) {
    return [{ name: '', value: "''" }]
  }

  return lines.map((line) => {
    const match = line.match(/^const\s+([A-Za-z_$][\w$]*)(?:\s*:\s*[^=;]+)?\s*=\s*(.+?);?$/)
    if (!match) {
      return { name: '', value: line }
    }

    return {
      name: match[1] ?? '',
      value: (match[2] ?? '').trim(),
    }
  })
}

function serializeConstantDefinitions(entries: ConstantEntry[]): string {
  return entries
    .filter((entry) => entry.name.trim().length > 0 || entry.value.trim().length > 0)
    .map((entry) => `const ${entry.name.trim()} = ${entry.value.trim()};`)
    .join('\n')
}

function quoteString(value: string): string {
  return `'${value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')}'`
}

function sanitiseBlockTitle(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}
