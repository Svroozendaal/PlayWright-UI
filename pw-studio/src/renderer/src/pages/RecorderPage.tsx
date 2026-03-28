import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RecorderStatus, Environment } from '../../../shared/types/ipc'
import { api } from '../api/client'
import { useSocketEvent } from '../api/useSocket'
import { ErrorBanner } from '../components/ErrorBanner'
import { FolderPicker } from '../components/FolderPicker'
import { useProject } from '../components/ProjectLayout'

function joinPath(directory: string, fileName: string): string {
  if (!directory) {
    return fileName
  }

  if (!fileName) {
    return directory
  }

  if (directory.endsWith('\\') || directory.endsWith('/')) {
    return `${directory}${fileName}`
  }

  if (directory.includes('\\')) {
    return `${directory}\\${fileName}`
  }

  return `${directory}/${fileName}`
}

export function RecorderPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project } = useProject()
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [startUrl, setStartUrl] = useState('http://localhost:3000')
  const [outputDirectory, setOutputDirectory] = useState('')
  const [fileName, setFileName] = useState('recorded-test.spec.ts')
  const [browser, setBrowser] = useState('chromium')
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [savedFile, setSavedFile] = useState<string | null>(null)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const outputPath = joinPath(outputDirectory.trim(), fileName.trim())

  useEffect(() => {
    const fetchStatus = async (): Promise<void> => {
      const result = await api.invoke<RecorderStatus>(IPC.RECORDER_STATUS)
      const envelope = result as IpcEnvelope<RecorderStatus>
      if (envelope.payload) setStatus(envelope.payload)
    }
    void fetchStatus()
  }, [])

  useEffect(() => {
    if (!outputDirectory && project?.rootPath) {
      setOutputDirectory(project.rootPath)
    }
  }, [outputDirectory, project?.rootPath])

  // Pre-fill start URL from active environment's baseURL
  useEffect(() => {
    if (!projectId || !project?.activeEnvironment) return
    const loadEnvUrl = async (): Promise<void> => {
      const result = await api.invoke<Environment[]>(IPC.ENVIRONMENTS_LIST, { projectId })
      const envelope = result as IpcEnvelope<Environment[]>
      const activeEnv = envelope.payload?.find((e) => e.name === project.activeEnvironment)
      if (activeEnv?.baseURL) setStartUrl(activeEnv.baseURL)
    }
    void loadEnvUrl()
  }, [projectId, project?.activeEnvironment])

  useSocketEvent<{ status: RecorderStatus; error?: string }>(IPC.RECORDER_STATUS, (data) => {
    setStatus(data.status)
    if (data.status === 'idle' && data.error) {
      setError({ code: 'UNKNOWN', message: data.error })
      return
    }

    if (data.status === 'idle' && outputPath) {
      void checkSavedFile(outputPath)
    }
  })

  const checkSavedFile = async (pathToCheck: string): Promise<void> => {
    if (!pathToCheck) return
    const result = await api.invoke<string | null>(IPC.RECORDER_SAVE, { outputPath: pathToCheck })
    const envelope = result as IpcEnvelope<string | null>
    if (envelope.payload) setSavedFile(envelope.payload)
  }

  const handleStart = async (): Promise<void> => {
    setError(null)
    setSavedFile(null)
    if (!outputDirectory || !fileName.trim()) {
      setError({ code: 'INVALID_PATH', message: 'Choose an output folder and file name before recording.' })
      return
    }
    const result = await api.invoke(IPC.RECORDER_START, {
      projectId,
      startUrl: startUrl || undefined,
      outputPath,
      browser,
    })
    const envelope = result as IpcEnvelope<void>
    if (envelope.error) setError(envelope.error)
  }

  const handleStop = async (): Promise<void> => {
    await api.invoke(IPC.RECORDER_STOP)
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Recorder</h2>
        <div className="page-header-actions">
          <div className={`recorder-status-indicator recorder-${status}`}>
            {status === 'running' ? 'Recording...' : 'Idle'}
          </div>
        </div>
      </div>

      {error && <ErrorBanner code={error.code} message={error.message} />}

      {savedFile && (
        <div className="recorder-saved-banner">
          Test recorded successfully: <code>{savedFile}</code>
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: 12 }}
            onClick={() => navigate(`/project/${projectId}/explorer`)}
          >
            Open in Explorer
          </button>
        </div>
      )}

      <div className="settings-section">
        <h3>Record a new test</h3>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          Playwright Codegen will open a browser. Interact with your app and close the browser when done — the test will be saved automatically.
        </p>

        <div className="form-group">
          <label>Start URL</label>
          <input
            type="text"
            value={startUrl}
            onChange={(e) => setStartUrl(e.target.value)}
            placeholder="http://localhost:3000"
            disabled={status === 'running'}
          />
        </div>

        <div className="form-group">
          <label>Output folder</label>
          <div className="path-input">
            <input
              type="text"
              value={outputDirectory}
              onChange={(e) => setOutputDirectory(e.target.value)}
              placeholder="Select a folder for the generated test..."
              disabled={status === 'running'}
            />
            <button className="btn btn-secondary" onClick={() => setShowFolderPicker(true)} disabled={status === 'running'}>
              Browse
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>File name</label>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="recorded-test.spec.ts"
            disabled={status === 'running'}
          />
        </div>

        <div className="form-group">
          <label>Full output path</label>
          <input type="text" value={outputPath} readOnly />
        </div>

        <div className="form-group">
          <label>Browser</label>
          <select
            value={browser}
            onChange={(e) => setBrowser(e.target.value)}
            className="form-select"
            disabled={status === 'running'}
          >
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {status === 'idle' ? (
            <button className="btn btn-primary" onClick={handleStart}>Start Recording</button>
          ) : (
            <button className="btn btn-danger" onClick={handleStop} style={{ background: '#e74c3c', color: '#fff', padding: '8px 16px', fontSize: 14 }}>
              Stop Recording
            </button>
          )}
        </div>
      </div>

      {showFolderPicker && (
        <FolderPicker
          title="Choose Recorder Output Folder"
          startPath={outputDirectory || project?.rootPath}
          onClose={() => setShowFolderPicker(false)}
          onSelect={(selectedPath) => {
            setOutputDirectory(selectedPath)
            setShowFolderPicker(false)
          }}
        />
      )}
    </div>
  )
}
