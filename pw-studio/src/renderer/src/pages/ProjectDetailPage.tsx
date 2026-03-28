import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC, ERROR_CODES } from '../../../shared/types/ipc'
import type { IpcEnvelope, RegisteredProject } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { HealthPanel } from '../components/HealthPanel'
import { ErrorBanner } from '../components/ErrorBanner'

export function ProjectDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<RegisteredProject | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const loadProject = async (): Promise<void> => {
      const result = await api.invoke<RegisteredProject>(IPC.PROJECTS_OPEN, { id })
      const envelope = result as IpcEnvelope<RegisteredProject>

      if (envelope.error) {
        setErrorCode(envelope.error.code)
        setErrorMessage(envelope.error.message)
        return
      }

      if (envelope.payload) {
        setProject(envelope.payload)
      }
    }

    void loadProject()
  }, [id])

  const handleRemoveProject = async (): Promise<void> => {
    if (!id) return
    await api.invoke(IPC.PROJECTS_REMOVE, { id })
    navigate('/')
  }

  const navBtn = (label: string, path: string): JSX.Element => (
    <button
      className="btn btn-secondary"
      style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
      onClick={() => navigate(path)}
    >
      {label}
    </button>
  )

  return (
    <>
      <header className="app-header">
        <button
          className="btn btn-secondary"
          style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
          onClick={() => navigate('/')}
        >
          Back
        </button>
        <h1>{project?.name ?? 'Loading...'}</h1>
        {project && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {navBtn('Explorer', `/project/${id}/explorer`)}
            {navBtn('Runs', `/project/${id}/runs`)}
            {navBtn('Recorder', `/project/${id}/recorder`)}
            {navBtn('Environments', `/project/${id}/environments`)}
            {navBtn('Flaky Tests', `/project/${id}/flaky`)}
            {navBtn('Settings', `/project/${id}/settings`)}
          </div>
        )}
      </header>
      <div className="page">
        {errorCode === ERROR_CODES.PROJECT_NOT_FOUND && (
          <ErrorBanner
            code={errorCode}
            message={errorMessage ?? undefined}
            onAction={handleRemoveProject}
            actionLabel="Remove from list"
          />
        )}

        {errorCode && errorCode !== ERROR_CODES.PROJECT_NOT_FOUND && (
          <ErrorBanner code={errorCode} message={errorMessage ?? undefined} />
        )}

        {project ? (
          <div>
            <div className="project-info-bar">
              <span>Path: {project.rootPath}</span>
              <span>Source: {project.source}</span>
              <span>Created: {new Date(project.createdAt).toLocaleDateString()}</span>
            </div>

            <HealthPanel projectId={project.id} />
          </div>
        ) : (
          !errorCode && <div className="placeholder">Loading project...</div>
        )}
      </div>
    </>
  )
}
