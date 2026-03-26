import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RecorderStatus, Environment } from '../../../shared/types/ipc'
import { ErrorBanner } from '../components/ErrorBanner'
import { useProject } from '../components/ProjectLayout'

export function RecorderPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { project } = useProject()
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [startUrl, setStartUrl] = useState('http://localhost:3000')
  const [outputPath, setOutputPath] = useState('')
  const [browser, setBrowser] = useState('chromium')
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [savedFile, setSavedFile] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async (): Promise<void> => {
      const result = await window.api.invoke<RecorderStatus>(IPC.RECORDER_STATUS)
      const envelope = result as IpcEnvelope<RecorderStatus>
      if (envelope.payload) setStatus(envelope.payload)
    }
    fetchStatus()
  }, [])

  // Pre-fill start URL from active environment's baseURL
  useEffect(() => {
    if (!projectId || !project?.activeEnvironment) return
    const loadEnvUrl = async (): Promise<void> => {
      const result = await window.api.invoke<Environment[]>(IPC.ENVIRONMENTS_LIST, { projectId })
      const envelope = result as IpcEnvelope<Environment[]>
      const activeEnv = envelope.payload?.find((e) => e.name === project.activeEnvironment)
      if (activeEnv?.baseURL) setStartUrl(activeEnv.baseURL)
    }
    loadEnvUrl()
  }, [projectId, project?.activeEnvironment])

  useEffect(() => {
    const handler = (...args: unknown[]): void => {
      const data = args[0] as { status: RecorderStatus; error?: string }
      setStatus(data.status)
      if (data.status === 'idle' && data.error) {
        setError({ code: 'UNKNOWN', message: data.error })
      }
      if (data.status === 'idle' && !data.error && outputPath) {
        checkSavedFile()
      }
    }
    window.api.on(IPC.RECORDER_STATUS, handler)
    return () => { window.api.off(IPC.RECORDER_STATUS, handler) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputPath])

  const checkSavedFile = async (): Promise<void> => {
    if (!outputPath) return
    const result = await window.api.invoke<string | null>(IPC.RECORDER_SAVE, { outputPath })
    const envelope = result as IpcEnvelope<string | null>
    if (envelope.payload) setSavedFile(envelope.payload)
  }

  const handleBrowse = async (): Promise<void> => {
    const result = await window.api.invoke<string | null>(IPC.DIALOG_SAVE_FILE, {
      defaultPath: 'recorded-test.spec.ts',
      filters: [
        { name: 'TypeScript', extensions: ['ts'] },
        { name: 'JavaScript', extensions: ['js'] },
      ],
    })
    const envelope = result as IpcEnvelope<string | null>
    if (envelope.payload) setOutputPath(envelope.payload)
  }

  const handleStart = async (): Promise<void> => {
    setError(null)
    setSavedFile(null)
    if (!outputPath) {
      setError({ code: 'INVALID_PATH', message: 'Please select an output file path first using the Browse button.' })
      return
    }
    const result = await window.api.invoke(IPC.RECORDER_START, {
      projectId,
      startUrl: startUrl || undefined,
      outputPath,
      browser,
    })
    const envelope = result as IpcEnvelope<void>
    if (envelope.error) setError(envelope.error)
  }

  const handleStop = async (): Promise<void> => {
    await window.api.invoke(IPC.RECORDER_STOP)
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
          <label>Output file</label>
          <div className="path-input">
            <input
              type="text"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="Click Browse to select output file..."
              disabled={status === 'running'}
            />
            <button className="btn btn-secondary" onClick={handleBrowse} disabled={status === 'running'}>
              Browse
            </button>
          </div>
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
    </div>
  )
}
