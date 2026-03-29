import { useEffect, useMemo, useState } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type {
  AvailableTestCase,
  BlockDefinition,
  BlockDisplayConfig,
  BlockFieldSchema,
  BlockFieldValue,
  BlockTemplate,
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
        <div className="test-editor-layout">
          <div className="test-editor-canvas">
            <div className="test-editor-panel-title test-editor-panel-title-row">
              <span>Visual steps</span>
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
            <DropZone
              active={dropIndex === 0}
              onDragOver={() => setDropIndex(0)}
              onDrop={() => applyDrop(0)}
            />
            {document.blocks.length === 0 ? (
              <div
                className="test-editor-empty"
                onDragOver={(event) => {
                  event.preventDefault()
                  setDropIndex(0)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  applyDrop(0)
                }}
              >
                Drag blocks here to build the test.
              </div>
            ) : (
              document.blocks.map((block, index) => (
                <div key={block.id}>
                  <div className="test-editor-flow-row">
                    <div className="test-editor-flow-dot" />
                    <div
                      className={`test-editor-block ${blockPanelMode === 'display' ? 'compact' : 'expanded'}`}
                      draggable
                      onDragStart={(event) => {
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
                          <div className="test-editor-block-subtitle">
                            {renderCompactSummary(block, libraryById, definitionsByKind)}
                          </div>
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
                  <DropZone
                    active={dropIndex === index + 1}
                    onDragOver={() => setDropIndex(index + 1)}
                    onDrop={() => applyDrop(index + 1)}
                  />
                </div>
              ))
            )}
          </div>

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
        </div>
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

function BlockFields({
  block,
  definition,
  availableTestCases,
  onChange,
}: {
  block: TestBlock
  definition?: BlockDefinition
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
          field={field}
          value={block.values[field.key]}
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
  field,
  value,
  availableTestCases,
  onChange,
}: {
  field: BlockFieldSchema
  value: BlockFieldValue | undefined
  availableTestCases: AvailableTestCase[]
  onChange: (value: BlockFieldValue) => void
}): JSX.Element {
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
    case 'text':
    default:
      return (
        <label>
          {field.label}
          <input
            placeholder={field.placeholder}
            value={getStringValue(value)}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
      )
  }
}

function SelectorEditor({
  label,
  selector,
  onChange,
}: {
  label: string
  selector: SelectorSpec
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
          <option value="test_id">Test ID</option>
          <option value="css">CSS</option>
        </select>
      </label>

      {selector.strategy === 'role' ? (
        <>
          <label>
            Role
            <input value={selector.value} onChange={(event) => onChange({ ...selector, value: event.target.value })} />
          </label>
          <label>
            Accessible name
            <input value={selector.name ?? ''} onChange={(event) => onChange({ ...selector, name: event.target.value })} />
          </label>
        </>
      ) : (
        <label>
          Value
          <input value={selector.value} onChange={(event) => onChange({ ...selector, value: event.target.value })} />
        </label>
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
  const body = document.blocks.map((block) => renderBlockPreview(block, definitionsByKind, '  ')).join('\n')
  const args = [quoteString(document.testTitle), ...document.template.extraArgs]
  const callback = renderCallbackPreview(document.template, body)
  args.push(callback)

  return `${document.template.callee}(${args.join(', ')})`
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
      case 'goto_url':
        return `await page.goto(${quoteString(getStringValue(block.values['url']))});${titleComment}`
      case 'click_element':
        return `await ${renderSelectorPreview(getSelectorValue(block.values['selector']))}.click();${titleComment}`
      case 'fill_field':
        return `await ${renderSelectorPreview(getSelectorValue(block.values['selector']))}.fill(${quoteString(getStringValue(block.values['value']))});${titleComment}`
      case 'expect_url':
        return `await expect(page).toHaveURL(${quoteString(getStringValue(block.values['url']))});${titleComment}`
      case 'use_subflow': {
        const target = getTestReferenceValue(block.values['target'])
        const stepTitle = getStringValue(block.values['stepTitle']) || target?.testTitle || 'Run subflow'
        const metadata = JSON.stringify(
          target ?? {
            filePath: '',
            ordinal: 0,
            testTitle: '',
          }
        )
        return [
          `await test.step(${quoteString(stepTitle)}, async () => {`,
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
        return `await mx.clickRowCell(${getStringValue(block.values['scope']) || 'page'}, { valueHint: ${quoteString(getStringValue(block.values['value']))}, container: ${quoteString(getStringValue(block.values['container']) || 'auto')}, confidence: ${quoteString(getStringValue(block.values['confidence']) || 'medium')} });${titleComment}`
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
        return `page.getByRole(${quoteString(selector.value)}, { name: ${quoteString(selector.name)} })`
      }
      return `page.getByRole(${quoteString(selector.value)})`
    case 'text':
      return `page.getByText(${quoteString(selector.value)})`
    case 'label':
      return `page.getByLabel(${quoteString(selector.value)})`
    case 'test_id':
      return `page.getByTestId(${quoteString(selector.value)})`
    case 'css':
      return `page.locator(${quoteString(selector.value)})`
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
