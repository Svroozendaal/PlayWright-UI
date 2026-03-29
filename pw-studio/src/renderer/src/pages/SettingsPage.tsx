import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useParams } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type {
  IpcEnvelope,
  AppInfo,
  RegisteredProject,
  Environment,
  ProjectConfigSummary,
} from '../../../shared/types/ipc'
import { api } from '../api/client'

export function SettingsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [copied, setCopied] = useState(false)
  const [project, setProject] = useState<RegisteredProject | null>(null)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [browserProjects, setBrowserProjects] = useState<string[]>([])

  useEffect(() => {
    const load = async (): Promise<void> => {
      const result = await api.invoke<AppInfo>(IPC.SETTINGS_GET_APP_INFO)
      const envelope = result as IpcEnvelope<AppInfo>
      if (envelope.payload) {
        setAppInfo(envelope.payload)
      }
    }
    void load()
  }, [])

  useEffect(() => {
    if (!projectId) return

    const loadProject = async (): Promise<void> => {
      const result = await api.invoke<RegisteredProject>(IPC.PROJECTS_GET, { id: projectId })
      const envelope = result as IpcEnvelope<RegisteredProject>
      if (envelope.payload) setProject(envelope.payload)
    }

    const loadEnvs = async (): Promise<void> => {
      const result = await api.invoke<Environment[]>(IPC.ENVIRONMENTS_LIST, { projectId })
      const envelope = result as IpcEnvelope<Environment[]>
      if (envelope.payload) setEnvironments(envelope.payload)
    }

    const loadBrowsers = async (): Promise<void> => {
      const result = await api.invoke<ProjectConfigSummary>(IPC.HEALTH_GET_CONFIG, { projectId })
      const envelope = result as IpcEnvelope<ProjectConfigSummary>
      if (envelope.payload?.projects) setBrowserProjects(envelope.payload.projects)
    }

    void loadProject()
    void loadEnvs()
    void loadBrowsers()
  }, [projectId])

  const handleCopy = async (text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text for manual copy
    }
  }

  const handleUpdateBrowser = async (value: string): Promise<void> => {
    if (!projectId) return
    await api.invoke(IPC.PROJECTS_UPDATE_SETTINGS, {
      projectId,
      defaultBrowser: value || null,
    })
    if (project) setProject({ ...project, defaultBrowser: value || null })
  }

  const handleUpdateEnv = async (value: string): Promise<void> => {
    if (!projectId) return
    await api.invoke(IPC.PROJECTS_UPDATE_SETTINGS, {
      projectId,
      activeEnvironment: value || null,
    })
    if (project) setProject({ ...project, activeEnvironment: value || null })
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div>
        {projectId && project && (
          <div className="settings-section">
            <h3>Project Defaults</h3>

            <div className="settings-row">
              <span className="settings-label">Default browser</span>
              <select
                className="form-select"
                value={project.defaultBrowser ?? ''}
                onChange={(e) => handleUpdateBrowser(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">All browsers</option>
                {browserProjects.length > 0 ? (
                  browserProjects.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))
                ) : (
                  <>
                    <option value="chromium">chromium</option>
                    <option value="firefox">firefox</option>
                    <option value="webkit">webkit</option>
                  </>
                )}
              </select>
            </div>

            <div className="settings-row">
              <span className="settings-label">Active environment</span>
              <select
                className="form-select"
                value={project.activeEnvironment ?? ''}
                onChange={(e) => handleUpdateEnv(e.target.value)}
                style={{ minWidth: 160 }}
              >
                <option value="">None</option>
                {environments.map((env) => (
                  <option key={env.name} value={env.name}>{env.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="settings-section">
          <h3>App</h3>

          <div className="settings-row">
            <span className="settings-label">Version</span>
            <span className="settings-value">{appInfo?.version ?? '...'}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Database location</span>
            <span className="settings-value">
              {appInfo?.databasePath ?? '...'}
              {appInfo?.databasePath && (
                <button
                  className={`btn-copy ${copied ? 'copied' : ''}`}
                  onClick={() => handleCopy(appInfo.databasePath)}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </span>
          </div>

          <div className="settings-row">
            <span className="settings-label">User data folder</span>
            <span className="settings-value">{appInfo?.userDataPath ?? '...'}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Plugins</span>
            <span className="settings-value">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/settings/plugins')}
              >
                Open Plugin Manager
              </button>
              {projectId && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 8 }}
                  onClick={() => navigate(`/project/${projectId}/integrations`)}
                >
                  Project Integrations
                </button>
              )}
            </span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Visual block library</span>
            <span className="settings-value">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  navigate(projectId ? `/settings/block-library?projectId=${encodeURIComponent(projectId)}` : '/settings/block-library')
                }
              >
                Open Block Library
              </button>
            </span>
          </div>
        </div>

        <div className="settings-section">
          <h3>About</h3>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            PW Studio is a local web application that wraps Playwright Test with a GUI.
            It is an orchestration layer, not a replacement for Playwright.
          </p>
        </div>
      </div>
    </div>
  )
}
