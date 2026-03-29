import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RegisteredProject } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { CreateProjectWizard } from '../components/CreateProjectWizard'

/**
 * Render the project registry landing page with create and import actions.
 *
 * Returns:
 * Projects page element.
 */
export function ProjectsPage(): JSX.Element {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<RegisteredProject[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch the current project registry from the local API.
   *
   * Returns:
   * Promise that resolves when the in-memory project list has been refreshed.
   */
  const loadProjects = useCallback(async () => {
    const result = await api.invoke<RegisteredProject[]>(IPC.PROJECTS_LIST)
    const envelope = result as IpcEnvelope<RegisteredProject[]>
    if (envelope.payload) {
      setProjects(envelope.payload)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  /**
   * Import an existing Playwright project from a selected filesystem path.
   *
   * Params:
   * rootPath - Absolute project directory chosen by the user.
   *
   * Returns:
   * Promise that resolves when the import flow finishes.
   */
  const handleImport = async (rootPath: string): Promise<void> => {
    setError(null)
    const result = await api.invoke<RegisteredProject>(IPC.PROJECTS_IMPORT, { rootPath })
    const envelope = result as IpcEnvelope<RegisteredProject>

    if (envelope.error) {
      setError(envelope.error.message)
      return
    }

    await loadProjects()
  }

  /**
   * Open the native operating system folder chooser for the import flow.
   *
   * Returns:
   * Promise that resolves when the browse and optional import flow completes.
   */
  const handleBrowseForImport = async (): Promise<void> => {
    setError(null)

    const result = await api.openDirectoryDialog({
      title: 'Import Project Folder',
    })

    if (result.error) {
      setError(result.error.message)
      return
    }

    if (result.payload) {
      await handleImport(result.payload)
    }
  }

  /**
   * Remove a project registration without deleting files from disk.
   *
   * Params:
   * e - Click event from the remove button.
   * id - Registered project identifier to remove.
   *
   * Returns:
   * Promise that resolves when the registry has been refreshed.
   */
  const handleRemove = async (e: React.MouseEvent, id: string): Promise<void> => {
    e.stopPropagation()
    await api.invoke(IPC.PROJECTS_REMOVE, { id })
    await loadProjects()
  }

  /**
   * Navigate to the selected project dashboard.
   *
   * Params:
   * id - Registered project identifier to open.
   *
   * Returns:
   * Nothing.
   */
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
          <button className="btn btn-secondary" onClick={() => void handleBrowseForImport()}>
            Import Project
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/settings/block-library')}>
            Block Library
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
