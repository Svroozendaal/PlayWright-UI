import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type {
  BlockDisplayConfig,
  BlockLibraryProjectState,
  BlockTemplate,
  IpcEnvelope,
  ManagedBlockTemplate,
  RegisteredProject,
  SelectorSpec,
  TestBlockTemplate,
} from '../../../shared/types/ipc'
import { api } from '../api/client'

type DraftTemplate = BlockTemplate

export function BlockLibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryProjectId = searchParams.get('projectId') ?? ''
  const [projects, setProjects] = useState<RegisteredProject[]>([])
  const [state, setState] = useState<BlockLibraryProjectState | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string>(queryProjectId)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftTemplate | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      const result = await api.invoke<RegisteredProject[]>(IPC.PROJECTS_LIST)
      const envelope = result as IpcEnvelope<RegisteredProject[]>
      if (envelope.payload) {
        setProjects(envelope.payload)
      }
    })()
  }, [])

  useEffect(() => {
    setSelectedProjectId(queryProjectId)
  }, [queryProjectId])

  useEffect(() => {
    void loadState(selectedProjectId)
  }, [selectedProjectId])

  const customTemplates = useMemo(
    () => (state?.templates ?? []).filter((template) => !template.builtIn).map(stripManagedTemplate),
    [state]
  )

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId || !state) {
      return null
    }

    return state.templates.find((template) => template.id === selectedTemplateId) ?? null
  }, [selectedTemplateId, state])

  useEffect(() => {
    if (!selectedTemplate) {
      return
    }

    setDraft(stripManagedTemplate(selectedTemplate))
  }, [selectedTemplate])

  const hasProjectContext = selectedProjectId.length > 0

  async function loadState(projectId?: string): Promise<void> {
    const result = projectId
      ? await api.invoke<BlockLibraryProjectState>(IPC.BLOCK_LIBRARY_PROJECT, { projectId })
      : await api.invoke<BlockLibraryProjectState>(IPC.BLOCK_LIBRARY_TEMPLATES)

    const envelope = result as IpcEnvelope<BlockLibraryProjectState>
    if (!envelope.payload) {
      return
    }

    const payload = envelope.payload
    setState(payload)
    setSelectedTemplateId((current) => {
      if (current && payload.templates.some((template) => template.id === current)) {
        return current
      }
      return payload.templates[0]?.id ?? null
    })
  }

  async function saveCustomTemplates(nextTemplates: BlockTemplate[]): Promise<void> {
    setSaving(true)
    const result = await api.invoke<BlockLibraryProjectState>(IPC.BLOCK_LIBRARY_TEMPLATES_SAVE, {
      templates: nextTemplates,
    })
    const envelope = result as IpcEnvelope<BlockLibraryProjectState>
    setSaving(false)
    if (!envelope.payload) {
      return
    }

    const payload = envelope.payload
    setState((current) => ({
      ...(current ?? payload),
      ...payload,
      includedTemplateIds: current?.includedTemplateIds ?? payload.includedTemplateIds,
      projectConfigPath: current?.projectConfigPath ?? payload.projectConfigPath,
    }))
    setSelectedTemplateId(draft?.id ?? payload.templates[0]?.id ?? null)

    if (selectedProjectId) {
      await loadState(selectedProjectId)
    }
  }

  async function handleSaveDraft(): Promise<void> {
    if (!draft) {
      return
    }

    const nextCustomTemplates = [...customTemplates]
    const existingIndex = nextCustomTemplates.findIndex((template) => template.id === draft.id)
    if (existingIndex >= 0) {
      nextCustomTemplates[existingIndex] = draft
    } else {
      nextCustomTemplates.push(draft)
    }

    await saveCustomTemplates(nextCustomTemplates)
  }

  async function handleDeleteDraft(): Promise<void> {
    if (!draft) {
      return
    }

    await saveCustomTemplates(customTemplates.filter((template) => template.id !== draft.id))
    setDraft(null)
    setSelectedTemplateId(state?.templates.find((template) => template.id !== draft.id)?.id ?? null)
  }

  async function handleToggleProjectTemplate(templateId: string): Promise<void> {
    if (!selectedProjectId || !state) {
      return
    }

    const nextIds = state.includedTemplateIds.includes(templateId)
      ? state.includedTemplateIds.filter((id) => id !== templateId)
      : [...state.includedTemplateIds, templateId]

    setSaving(true)
    const result = await api.invoke<BlockLibraryProjectState>(IPC.BLOCK_LIBRARY_PROJECT_SAVE, {
      projectId: selectedProjectId,
      includedTemplateIds: nextIds,
    })
    const envelope = result as IpcEnvelope<BlockLibraryProjectState>
    setSaving(false)
    if (envelope.payload) {
      setState(envelope.payload)
    }
  }

  function handleCreateTemplate(): void {
    const nextName = createUniqueTemplateName(state?.templates ?? [])
    const nextDraft: DraftTemplate = {
      id: slugify(nextName),
      name: nextName,
      description: '',
      category: 'Custom',
      block: {
        kind: 'goto_url',
        url: 'https://example.com/',
      },
      display: {
        label: nextName,
        detailSource: 'url',
        separator: ': ',
      },
    }

    setDraft(nextDraft)
    setSelectedTemplateId(null)
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Block Library</h2>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>
            Back to Settings
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleCreateTemplate}>
            New Block
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Storage</h3>
        <div className="settings-row">
          <span className="settings-label">Global block file</span>
          <span className="settings-value">{state?.globalTemplatesPath ?? 'Loading...'}</span>
        </div>
        {hasProjectContext && (
          <div className="settings-row">
            <span className="settings-label">Project include file</span>
            <span className="settings-value">{state?.projectConfigPath ?? 'Loading...'}</span>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>Project Availability</h3>
        <div className="form-group">
          <label>Project</label>
          <select
            className="form-select"
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
          >
            <option value="">No project selected</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        {hasProjectContext && state && (
          <div className="block-library-availability-list">
            {state.templates.map((template) => (
              <label key={template.id} className="block-library-availability-row">
                <span>
                  <strong>{template.name}</strong>
                  <span className="block-library-template-meta">
                    {template.builtIn ? 'Built-in' : 'Custom'}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={state.includedTemplateIds.includes(template.id)}
                  onChange={() => void handleToggleProjectTemplate(template.id)}
                  disabled={saving}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="block-library-page-grid">
        <div className="settings-section">
          <h3>Available Blocks</h3>
          <div className="block-library-list">
            {(state?.templates ?? []).map((template) => (
              <button
                key={template.id}
                className={`block-library-list-item ${selectedTemplateId === template.id ? 'active' : ''}`}
                onClick={() => setSelectedTemplateId(template.id)}
              >
                <span className="block-library-list-title">{template.name}</span>
                <span className="block-library-list-meta">
                  {template.category} · {template.builtIn ? 'Built-in' : 'Custom'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>{draft ? 'Configure Block' : 'Select a block'}</h3>
          {draft ? (
            <>
              {!selectedTemplate?.builtIn ? (
                <>
                  <div className="form-group">
                    <label>Block title</label>
                    <input
                      type="text"
                      value={draft.name}
                      onChange={(event) => {
                        const name = event.target.value
                        setDraft({
                          ...draft,
                          name,
                          id: selectedTemplate && !selectedTemplate.builtIn ? draft.id : slugify(name),
                          display: {
                            ...draft.display,
                            label: draft.display?.label === draft.name ? name : draft.display?.label ?? name,
                            detailSource: draft.display?.detailSource ?? getDefaultDetailSource(draft.block.kind),
                          },
                        })
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <input
                      type="text"
                      value={draft.category}
                      onChange={(event) => setDraft({ ...draft, category: event.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Description</label>
                    <textarea
                      rows={3}
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Block type</label>
                    <select
                      className="form-select"
                      value={draft.block.kind}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          block: createDefaultBlock(event.target.value as TestBlockTemplate['kind']),
                          display: {
                            label: draft.name,
                            detailSource: getDefaultDetailSource(event.target.value as TestBlockTemplate['kind']),
                            separator: ': ',
                          },
                        })
                      }
                    >
                      <option value="goto_url">Go to URL</option>
                      <option value="click_element">Click element</option>
                      <option value="fill_field">Fill field</option>
                      <option value="expect_url">Expect URL</option>
                      <option value="raw_code">Raw code</option>
                    </select>
                  </div>

                  <TemplateBlockFields
                    block={draft.block}
                    onChange={(block) => setDraft({ ...draft, block })}
                  />

                  <div className="form-group">
                    <label>Display label</label>
                    <input
                      type="text"
                      value={draft.display?.label ?? ''}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          display: {
                            label: event.target.value,
                            detailSource: draft.display?.detailSource ?? getDefaultDetailSource(draft.block.kind),
                            quoteDetail: draft.display?.quoteDetail,
                            hideTitle: draft.display?.hideTitle,
                            separator: draft.display?.separator,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="block-library-display-grid">
                    <label>
                      Detail source
                      <select
                        className="form-select"
                        value={draft.display?.detailSource ?? getDefaultDetailSource(draft.block.kind)}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            display: {
                              label: draft.display?.label ?? draft.name,
                              detailSource: event.target.value as BlockDisplayConfig['detailSource'],
                              quoteDetail: draft.display?.quoteDetail,
                              hideTitle: draft.display?.hideTitle,
                              separator: draft.display?.separator,
                            },
                          })
                        }
                      >
                        {getDetailOptions(draft.block.kind).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Separator
                      <select
                        className="form-select"
                        value={draft.display?.separator ?? ': '}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            display: {
                              label: draft.display?.label ?? draft.name,
                              detailSource: draft.display?.detailSource ?? getDefaultDetailSource(draft.block.kind),
                              quoteDetail: draft.display?.quoteDetail,
                              hideTitle: draft.display?.hideTitle,
                              separator: event.target.value as BlockDisplayConfig['separator'],
                            },
                          })
                        }
                      >
                        <option value=": ">Label: detail</option>
                        <option value=" ">Label detail</option>
                      </select>
                    </label>
                  </div>

                  <label className="block-library-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.display?.quoteDetail)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          display: {
                            label: draft.display?.label ?? draft.name,
                            detailSource: draft.display?.detailSource ?? getDefaultDetailSource(draft.block.kind),
                            quoteDetail: event.target.checked,
                            hideTitle: draft.display?.hideTitle,
                            separator: draft.display?.separator,
                          },
                        })
                      }
                    />
                    Quote detail in display mode
                  </label>

                  <label className="block-library-checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.display?.hideTitle)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          display: {
                            label: draft.display?.label ?? draft.name,
                            detailSource: draft.display?.detailSource ?? getDefaultDetailSource(draft.block.kind),
                            quoteDetail: draft.display?.quoteDetail,
                            hideTitle: event.target.checked,
                            separator: draft.display?.separator,
                          },
                        })
                      }
                    />
                    Hide title in compact display
                  </label>

                  <div className="modal-actions">
                    {selectedTemplate && !selectedTemplate.builtIn && (
                      <button className="btn btn-danger" onClick={() => void handleDeleteDraft()} disabled={saving}>
                        Delete
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={() => void handleSaveDraft()} disabled={saving}>
                      {saving ? 'Saving...' : 'Save Block'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="detail-info-content">
                  <p>Built-in blocks are read-only.</p>
                  <p><strong>Title:</strong> {selectedTemplate.name}</p>
                  <p><strong>Category:</strong> {selectedTemplate.category}</p>
                  {selectedTemplate.description && <p>{selectedTemplate.description}</p>}
                </div>
              )}
            </>
          ) : (
            <p>Select a block from the list or create a new custom block.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function TemplateBlockFields({
  block,
  onChange,
}: {
  block: TestBlockTemplate
  onChange: (block: TestBlockTemplate) => void
}): JSX.Element {
  switch (block.kind) {
    case 'goto_url':
      return (
        <div className="form-group">
          <label>Default URL</label>
          <input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} />
        </div>
      )
    case 'expect_url':
      return (
        <div className="form-group">
          <label>Default expected URL</label>
          <input value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} />
        </div>
      )
    case 'click_element':
      return <TemplateSelectorEditor selector={block.selector} onChange={(selector) => onChange({ ...block, selector })} />
    case 'fill_field':
      return (
        <>
          <TemplateSelectorEditor selector={block.selector} onChange={(selector) => onChange({ ...block, selector })} />
          <div className="form-group">
            <label>Default value</label>
            <input value={block.value} onChange={(event) => onChange({ ...block, value: event.target.value })} />
          </div>
        </>
      )
    case 'raw_code':
      return (
        <div className="form-group">
          <label>Default raw code</label>
          <textarea rows={6} value={block.code} onChange={(event) => onChange({ ...block, code: event.target.value })} />
        </div>
      )
  }
}

function TemplateSelectorEditor({
  selector,
  onChange,
}: {
  selector: SelectorSpec
  onChange: (selector: SelectorSpec) => void
}): JSX.Element {
  return (
    <div className="block-library-display-grid">
      <label>
        Selector type
        <select
          className="form-select"
          value={selector.strategy}
          onChange={(event) => {
            const strategy = event.target.value as SelectorSpec['strategy']
            onChange({
              strategy,
              value: strategy === 'role' ? 'button' : '',
              name: strategy === 'role' ? '' : undefined,
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

function stripManagedTemplate(template: ManagedBlockTemplate): BlockTemplate {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    category: template.category,
    block: template.block,
    display: template.display,
  }
}

function createUniqueTemplateName(templates: ManagedBlockTemplate[]): string {
  const lowerNames = new Set(templates.map((template) => template.name.trim().toLowerCase()))
  let index = 1
  let candidate = 'New block'

  while (lowerNames.has(candidate.toLowerCase())) {
    index += 1
    candidate = `New block ${index}`
  }

  return candidate
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom-block'
}

function createDefaultBlock(kind: TestBlockTemplate['kind']): TestBlockTemplate {
  switch (kind) {
    case 'goto_url':
      return { kind, url: 'https://example.com/' }
    case 'click_element':
      return { kind, selector: { strategy: 'role', value: 'button', name: 'Submit' } }
    case 'fill_field':
      return { kind, selector: { strategy: 'label', value: 'Email' }, value: 'user@example.com' }
    case 'expect_url':
      return { kind, url: 'https://example.com/dashboard' }
    case 'raw_code':
      return { kind, code: "await expect(page.getByText('Done')).toBeVisible();" }
  }
}

function getDefaultDetailSource(kind: TestBlockTemplate['kind']): BlockDisplayConfig['detailSource'] {
  switch (kind) {
    case 'goto_url':
    case 'expect_url':
      return 'url'
    case 'click_element':
      return 'selector.name'
    case 'fill_field':
      return 'selector.value'
    case 'raw_code':
      return 'code'
  }
}

function getDetailOptions(kind: TestBlockTemplate['kind']): BlockDisplayConfig['detailSource'][] {
  switch (kind) {
    case 'goto_url':
    case 'expect_url':
      return ['url']
    case 'click_element':
      return ['selector.name', 'selector.value']
    case 'fill_field':
      return ['selector.value', 'value', 'selector.name']
    case 'raw_code':
      return ['code']
  }
}
