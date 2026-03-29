import { useEffect, useMemo, useState } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type {
  BlockDisplayConfig,
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
  const [library, setLibrary] = useState<ManagedBlockTemplate[]>([])
  const [availableTemplateIds, setAvailableTemplateIds] = useState<string[]>([])
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
        setLibrary(libraryEnvelope.payload.templates)
        setAvailableTemplateIds(libraryEnvelope.payload.availableTemplateIds)
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
  const libraryGroups = useMemo(() => groupLibraryByCategory(availableLibrary), [availableLibrary])
  const libraryById = useMemo(
    () => new Map(library.map((template) => [template.id, template] as const)),
    [library]
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
        setCodeDraft(renderDocumentPreview(next))
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
            createBlockFromTemplate(
              dragState.template.block,
              nextBlocks,
              dragState.template.id,
              dragState.template.name
            )
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
                          {shouldShowCompactTitle(block, libraryById) && (
                            <div className="test-editor-block-title">{blockTitle(block)}</div>
                          )}
                          <div className="test-editor-block-subtitle">
                            {renderCompactSummary(block, libraryById)}
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
                        applyLibraryTemplate(template, codeDirty, updateDocument)
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
  codeDirty: boolean,
  updateDocument: (
    updater: (current: TestEditorDocument) => TestEditorDocument,
    options?: { keepCodeDraft?: boolean; notice?: string | null }
  ) => void
): void {
  updateDocument(
    (current) => {
      const nextBlocks = [...current.blocks]
      nextBlocks.push(createBlockFromTemplate(template.block, nextBlocks, template.id, template.name))
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
  templateId?: string,
  templateName?: string
): TestBlock {
  return {
    ...template,
    id: crypto.randomUUID(),
    title: createUniqueBlockTitle(templateName ?? blockTitleFromKind(template.kind), existingBlocks),
    templateId,
  } as TestBlock
}

function blockTitle(block: TestBlock): string {
  return block.title
}

function blockTitleFromKind(kind: TestBlock['kind']): string {
  switch (kind) {
    case 'goto_url':
      return 'go to url'
    case 'click_element':
      return 'click element'
    case 'fill_field':
      return 'fill field'
    case 'expect_url':
      return 'expect url'
    case 'raw_code':
      return 'raw code'
  }
}

function blockKindLabel(block: TestBlock): string {
  switch (block.kind) {
    case 'goto_url':
      return 'Go to URL'
    case 'click_element':
      return 'Click element'
    case 'fill_field':
      return 'Fill field'
    case 'expect_url':
      return 'Expect URL'
    case 'raw_code':
      return 'Raw code'
  }
}

function shouldShowCompactTitle(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>
): boolean {
  if (block.kind === 'raw_code') {
    return true
  }
  return !resolveDisplayConfig(block, libraryById)?.hideTitle
}

function renderCompactSummary(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>
): string {
  const display = resolveDisplayConfig(block, libraryById)
  if (!display) {
    return blockKindLabel(block)
  }

  const detail = getDisplayDetail(block, display.detailSource)
  if (!detail) {
    return display.label
  }

  const formatted = display.quoteDetail ? `'${detail}'` : detail
  if (display.label.length === 0) {
    return formatted
  }

  if (display.detailSource === 'code') {
    return formatted
  }

  return `${display.label}${display.separator ?? ': '}${formatted}`
}

function resolveDisplayConfig(
  block: TestBlock,
  libraryById: Map<string, BlockTemplate>
): BlockDisplayConfig | null {
  if (block.templateId) {
    const templateDisplay = libraryById.get(block.templateId)?.display
    if (templateDisplay) {
      return templateDisplay
    }
  }

  return defaultDisplayByKind[block.kind] ?? null
}

function getDisplayDetail(block: TestBlock, source: BlockDisplayConfig['detailSource']): string {
  switch (source) {
    case 'url':
      return 'url' in block ? block.url : ''
    case 'value':
      return 'value' in block ? block.value : ''
    case 'selector.value':
      return 'selector' in block ? block.selector.value : ''
    case 'selector.name':
      return 'selector' in block ? block.selector.name ?? block.selector.value : ''
    case 'code':
      return block.kind === 'raw_code' ? summariseRawCode(block.code) : ''
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
  onChange,
}: {
  block: TestBlock
  onChange: (block: TestBlock) => void
}): JSX.Element {
  switch (block.kind) {
    case 'goto_url':
      return (
        <div className="test-editor-field-grid">
          <label>
            URL
            <input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} />
          </label>
        </div>
      )
    case 'expect_url':
      return (
        <div className="test-editor-field-grid">
          <label>
            Expected URL
            <input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} />
          </label>
        </div>
      )
    case 'click_element':
      return (
        <div className="test-editor-field-grid">
          <SelectorEditor selector={block.selector} onChange={(selector) => onChange({ ...block, selector })} />
        </div>
      )
    case 'fill_field':
      return (
        <div className="test-editor-field-grid">
          <SelectorEditor selector={block.selector} onChange={(selector) => onChange({ ...block, selector })} />
          <label>
            Value
            <input value={block.value} onChange={(event) => onChange({ ...block, value: event.target.value })} />
          </label>
        </div>
      )
    case 'raw_code':
      return (
        <div className="test-editor-field-grid">
          <label>
            Code
            <textarea
              className="test-editor-raw-code"
              value={block.code}
              onChange={(event) => onChange({ ...block, code: event.target.value })}
              rows={Math.max(4, block.code.split('\n').length)}
            />
          </label>
        </div>
      )
  }
}

function SelectorEditor({
  selector,
  onChange,
}: {
  selector: SelectorSpec
  onChange: (selector: SelectorSpec) => void
}): JSX.Element {
  return (
    <div className="test-editor-selector-grid">
      <label>
        Selector type
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

function renderDocumentPreview(document: TestEditorDocument): string {
  const body = document.blocks.map((block) => renderBlockPreview(block, '  ')).join('\n')
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

function renderBlockPreview(block: TestBlock, indent: string): string {
  const raw = (() => {
    const titleComment = ` // ${sanitiseBlockTitle(block.title)}`
    switch (block.kind) {
      case 'goto_url':
        return `await page.goto(${quoteString(block.url)});${titleComment}`
      case 'click_element':
        return `await ${renderSelectorPreview(block.selector)}.click();${titleComment}`
      case 'fill_field':
        return `await ${renderSelectorPreview(block.selector)}.fill(${quoteString(block.value)});${titleComment}`
      case 'expect_url':
        return `await expect(page).toHaveURL(${quoteString(block.url)});${titleComment}`
      case 'raw_code':
        if (block.code.trim().length === 0) {
          return `// ${sanitiseBlockTitle(block.title)}`
        }
        return `// ${sanitiseBlockTitle(block.title)}\n${block.code}`
    }
  })()

  return raw
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n')
}

function renderSelectorPreview(selector: SelectorSpec): string {
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

const defaultDisplayByKind: Record<TestBlock['kind'], BlockDisplayConfig> = {
  goto_url: {
    label: 'Go to URL',
    detailSource: 'url',
    separator: ': ',
  },
  click_element: {
    label: 'Click element',
    detailSource: 'selector.name',
    quoteDetail: true,
    separator: ' ',
  },
  fill_field: {
    label: 'Fill field',
    detailSource: 'selector.value',
    quoteDetail: true,
    separator: ': ',
  },
  expect_url: {
    label: 'Expect URL',
    detailSource: 'url',
    separator: ': ',
  },
  raw_code: {
    label: 'Raw code',
    detailSource: 'code',
  },
}
