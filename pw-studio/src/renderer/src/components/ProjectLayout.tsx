import { useState, useEffect, createContext, useContext } from 'react'
import { Outlet, useParams, useNavigate } from 'react-router-dom'
import { IPC, ERROR_CODES } from '../../../shared/types/ipc'
import type { IpcEnvelope, RegisteredProject, HealthSnapshot } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'
import { Sidebar } from './Sidebar'
import { ErrorBanner } from './ErrorBanner'

type ProjectContextValue = {
  project: RegisteredProject
  health: HealthSnapshot | null
  refreshHealth: () => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectLayout')
  return ctx
}

export function ProjectLayout(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<RegisteredProject | null>(null)
  const [health, setHealth] = useState<HealthSnapshot | null>(null)
  const [hasActiveRun, setHasActiveRun] = useState(false)
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

  // Load health on project load
  useEffect(() => {
    if (!project) return

    const loadHealth = async (): Promise<void> => {
      const result = await api.invoke<HealthSnapshot>(IPC.HEALTH_GET, {
        projectId: project.id,
      })
      const envelope = result as IpcEnvelope<HealthSnapshot>
      if (envelope.payload) {
        setHealth(envelope.payload)
      }
    }

    void loadHealth()
  }, [project])

  // Track active run
  useEffect(() => {
    if (!id) return

    const checkActive = async (): Promise<void> => {
      const result = await api.invoke<string | null>(IPC.RUNS_GET_ACTIVE, { projectId: id })
      const envelope = result as IpcEnvelope<string | null>
      setHasActiveRun(!!envelope.payload)
    }

    void checkActive()
  }, [id])

  useSocketEvent(IPC.RUNS_STATUS_CHANGED, () => {
    if (!id) {
      return
    }

    void api.invoke<string | null>(IPC.RUNS_GET_ACTIVE, { projectId: id }).then((result) => {
      const envelope = result as IpcEnvelope<string | null>
      setHasActiveRun(!!envelope.payload)
    })
  })

  useSocketEvent<{ projectId: string }>(IPC.HEALTH_REFRESH, (event) => {
    if (!project || event.projectId !== project.id) {
      return
    }

    void api.invoke<HealthSnapshot>(IPC.HEALTH_GET, { projectId: project.id }).then((result) => {
      const envelope = result as IpcEnvelope<HealthSnapshot>
      if (envelope.payload) {
        setHealth(envelope.payload)
      }
    })
  })

  const refreshHealth = async (): Promise<void> => {
    if (!project) return
    const result = await api.invoke<HealthSnapshot>(IPC.HEALTH_REFRESH, {
      projectId: project.id,
    })
    const envelope = result as IpcEnvelope<HealthSnapshot>
    if (envelope.payload) {
      setHealth(envelope.payload)
    }
  }

  const handleRemoveProject = async (): Promise<void> => {
    if (!id) return
    await api.invoke(IPC.PROJECTS_REMOVE, { id })
    navigate('/')
  }

  if (errorCode) {
    return (
      <div className="page" style={{ paddingTop: 48 }}>
        <ErrorBanner
          code={errorCode}
          message={errorMessage ?? undefined}
          onAction={errorCode === ERROR_CODES.PROJECT_NOT_FOUND ? handleRemoveProject : undefined}
          actionLabel={errorCode === ERROR_CODES.PROJECT_NOT_FOUND ? 'Remove from list' : undefined}
        />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="page" style={{ paddingTop: 48 }}>
        <div className="placeholder">Loading project...</div>
      </div>
    )
  }

  return (
    <ProjectContext.Provider value={{ project, health, refreshHealth }}>
      <div className="project-layout">
        <Sidebar project={project} health={health} hasActiveRun={hasActiveRun} />
        <main className="project-content">
          <Outlet />
        </main>
      </div>
    </ProjectContext.Provider>
  )
}
