import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RegisteredProject } from '../../../shared/types/ipc'
import { CreateProjectWizard } from '../components/CreateProjectWizard'

export function ProjectsPage(): JSX.Element {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<RegisteredProject[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadProjects = useCallback(async () => {
    const result = await window.api.invoke<RegisteredProject[]>(IPC.PROJECTS_LIST)
    const envelope = result as IpcEnvelope<RegisteredProject[]>
    if (envelope.payload) {
      setProjects(envelope.payload)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleImport = async (): Promise<void> => {
    setError(null)
    const dirResult = await window.api.invoke<string | null>(IPC.DIALOG_OPEN_DIRECTORY)
    const dirEnvelope = dirResult as IpcEnvelope<string | null>

    if (!dirEnvelope.payload) return

    const result = await window.api.invoke<RegisteredProject>(IPC.PROJECTS_IMPORT, {
      rootPath: dirEnvelope.payload,
    })
    const envelope = result as IpcEnvelope<RegisteredProject>

    if (envelope.error) {
      setError(envelope.error.message)
      return
    }

    await loadProjects()
  }

  const handleRemove = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation()
    await window.api.invoke(IPC.PROJECTS_REMOVE, { id })
    await loadProjects()
  }

  const handleOpenProject = (id: string): void => {
    navigate(`/project/${id}`)
  }

  return (
    <>
      <header className="app-header">
        <h1>PW Studio</h1>
      </header>
      <div className="page">
        <h2>Projects</h2>

        {error && <div className="error-message">{error}</div>}

        <div className="actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            New Project
          </button>
          <button className="btn btn-secondary" onClick={handleImport}>
            Import Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <h3>No projects yet</h3>
            <p>Create a new project or import an existing Playwright project.</p>
          </div>
        ) : (
          <div className="project-list">
            {projects.map((project) => (
              <div
                key={project.id}
                className="project-card"
                onClick={() => handleOpenProject(project.id)}
              >
                <div className="project-card-info">
                  <h3>{project.name}</h3>
                  <p>{project.rootPath}</p>
                </div>
                <div className="project-card-actions">
                  <span className="btn btn-secondary" style={{ fontSize: '12px', padding: '4px 8px' }}>
                    {project.source}
                  </span>
                  <button
                    className="btn btn-danger"
                    onClick={(e) => handleRemove(e, project.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <CreateProjectWizard
            onClose={() => setShowCreateModal(false)}
            onCreated={() => {
              setShowCreateModal(false)
              loadProjects()
            }}
          />
        )}
      </div>
    </>
  )
}
