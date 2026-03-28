import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, Environment } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'

type EditingEnv = {
  name: string
  baseURL: string
  variables: { key: string; value: string }[]
}

function emptyEnv(): EditingEnv {
  return { name: '', baseURL: '', variables: [] }
}

function toEditing(env: Environment): EditingEnv {
  return {
    name: env.name,
    baseURL: env.baseURL,
    variables: Object.entries(env.variables).map(([key, value]) => ({ key, value })),
  }
}

function fromEditing(e: EditingEnv): Environment {
  const variables: Record<string, string> = {}
  for (const v of e.variables) {
    if (v.key.trim()) variables[v.key.trim()] = v.value
  }
  return { name: e.name, baseURL: e.baseURL, variables, secretRefs: {} }
}

export function EnvironmentsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [editing, setEditing] = useState<EditingEnv | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [activeEnv, setActiveEnv] = useState<string | null>(null)

  const fetchEnvs = useCallback(async () => {
    if (!projectId) return
    const result = await api.invoke<Environment[]>(IPC.ENVIRONMENTS_LIST, { projectId })
    const envelope = result as IpcEnvelope<Environment[]>
    if (envelope.payload) setEnvironments(envelope.payload)

    const projResult = await api.invoke<{ activeEnvironment: string | null }>(IPC.PROJECTS_GET, { id: projectId })
    const projEnvelope = projResult as IpcEnvelope<{ activeEnvironment: string | null }>
    if (projEnvelope.payload) setActiveEnv(projEnvelope.payload.activeEnvironment)
  }, [projectId])

  useEffect(() => {
    void fetchEnvs()
  }, [fetchEnvs])

  useSocketEvent(IPC.ENVIRONMENTS_CHANGED, () => {
    void fetchEnvs()
  })

  const handleCreate = (): void => {
    setEditing(emptyEnv())
    setIsNew(true)
  }

  const handleEdit = (env: Environment): void => {
    setEditing(toEditing(env))
    setIsNew(false)
  }

  const handleSave = async (): Promise<void> => {
    if (!editing || !projectId || !editing.name.trim()) return
    const env = fromEditing(editing)
    const channel = isNew ? IPC.ENVIRONMENTS_CREATE : IPC.ENVIRONMENTS_UPDATE
    await api.invoke(channel, { projectId, environment: env })
    setEditing(null)
    void fetchEnvs()
  }

  const handleDelete = async (name: string): Promise<void> => {
    if (!projectId) return
    await api.invoke(IPC.ENVIRONMENTS_DELETE, { projectId, name })
    if (editing?.name === name) setEditing(null)
    void fetchEnvs()
  }

  const handleSetActive = async (name: string | null): Promise<void> => {
    if (!projectId) return
    await api.invoke(IPC.PROJECTS_UPDATE_SETTINGS, {
      projectId,
      activeEnvironment: name,
    })
    setActiveEnv(name)
  }

  const addVariable = (): void => {
    if (!editing) return
    setEditing({ ...editing, variables: [...editing.variables, { key: '', value: '' }] })
  }

  const removeVariable = (index: number): void => {
    if (!editing) return
    setEditing({ ...editing, variables: editing.variables.filter((_, i) => i !== index) })
  }

  const updateVariable = (index: number, field: 'key' | 'value', val: string): void => {
    if (!editing) return
    const vars = [...editing.variables]
    const row = vars[index]
    if (row) {
      vars[index] = { ...row, [field]: val }
      setEditing({ ...editing, variables: vars })
    }
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Environments</h2>
        <div className="page-header-actions">
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>New Environment</button>
        </div>
      </div>
        {editing && (
          <div className="settings-section" style={{ marginBottom: 24 }}>
            <h3>{isNew ? 'Create Environment' : `Edit: ${editing.name}`}</h3>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                readOnly={!isNew}
                placeholder="e.g. staging"
              />
            </div>

            <div className="form-group">
              <label>Base URL</label>
              <input
                type="text"
                value={editing.baseURL}
                onChange={(e) => setEditing({ ...editing, baseURL: e.target.value })}
                placeholder="https://staging.example.com"
              />
            </div>

            <div className="form-group">
              <label>Variables</label>
              {editing.variables.map((v, i) => (
                <div key={i} className="kv-row">
                  <input
                    type="text"
                    value={v.key}
                    onChange={(e) => updateVariable(i, 'key', e.target.value)}
                    placeholder="KEY"
                    className="kv-key"
                  />
                  <input
                    type="text"
                    value={v.value}
                    onChange={(e) => updateVariable(i, 'value', e.target.value)}
                    placeholder="value"
                    className="kv-value"
                  />
                  <button className="btn btn-danger" onClick={() => removeVariable(i)}>X</button>
                </div>
              ))}
              <button className="btn btn-secondary" style={{ fontSize: 12, marginTop: 8 }} onClick={addVariable}>
                + Add variable
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!editing.name.trim()}>
                Save
              </button>
            </div>
          </div>
        )}

        {environments.length === 0 && !editing ? (
          <div className="empty-state">
            <h3>No environments</h3>
            <p>Create an environment to manage base URLs and variables for different targets.</p>
          </div>
        ) : (
          <div className="env-list">
            {environments.map((env) => (
              <div key={env.name} className={`env-card ${activeEnv === env.name ? 'env-card-active' : ''}`}>
                <div className="env-card-info">
                  <h4>
                    {env.name}
                    {activeEnv === env.name && <span className="env-active-badge">Active</span>}
                  </h4>
                  <p className="env-url">{env.baseURL || 'No base URL'}</p>
                  {Object.keys(env.variables).length > 0 && (
                    <p className="env-vars-count">
                      {Object.keys(env.variables).length} variable(s)
                    </p>
                  )}
                </div>
                <div className="env-card-actions">
                  {activeEnv !== env.name ? (
                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => handleSetActive(env.name)}>
                      Set Active
                    </button>
                  ) : (
                    <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => handleSetActive(null)}>
                      Deactivate
                    </button>
                  )}
                  <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => handleEdit(env)}>
                    Edit
                  </button>
                  <button className="btn btn-danger" onClick={() => handleDelete(env.name)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
