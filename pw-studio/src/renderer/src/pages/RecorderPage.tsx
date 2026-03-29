import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type {
  CodegenExtraction,
  CodegenSuggestion,
  Environment,
  IpcEnvelope,
  ProjectConfigSummary,
  RecorderSaveResult,
  RecorderStatus,
  RecorderStatusEvent,
} from '../../../shared/types/ipc'
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
  const [savedResult, setSavedResult] = useState<RecorderSaveResult | null>(null)
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
    if (!projectId || !project?.rootPath) {
      return
    }

    let cancelled = false

    const loadPreferredOutputDirectory = async (): Promise<void> => {
      const result = await api.invoke<ProjectConfigSummary>(IPC.HEALTH_GET_CONFIG, { projectId })
      const envelope = result as IpcEnvelope<ProjectConfigSummary>
      if (cancelled) {
        return
      }

      const preferredDirectory = envelope.payload?.testDir || project.rootPath
      setOutputDirectory((current) => {
        if (!current || current === project.rootPath) {
          return preferredDirectory
        }

        return current
      })
    }

    void loadPreferredOutputDirectory()

    return () => {
      cancelled = true
    }
  }, [projectId, project?.rootPath])

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

  useSocketEvent<RecorderStatusEvent>(IPC.RECORDER_STATUS, (data) => {
    setStatus(data.status)
    if (data.status === 'idle' && data.error) {
      setError({ code: 'UNKNOWN', message: data.error })
      return
    }

    if (data.status === 'idle' && data.result) {
      setSavedResult(data.result)
      return
    }

    if (data.status === 'idle' && outputPath) {
      void checkSavedFile(outputPath)
    }
  })

  const checkSavedFile = async (pathToCheck: string): Promise<void> => {
    if (!pathToCheck) return
    const result = await api.invoke<RecorderSaveResult | null>(IPC.RECORDER_SAVE, { outputPath: pathToCheck })
    const envelope = result as IpcEnvelope<RecorderSaveResult | null>
    if (envelope.payload) setSavedResult(envelope.payload)
  }

  const handleStart = async (): Promise<void> => {
    setError(null)
    setSavedResult(null)
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

  const selectorExtractions = savedResult?.extractions.filter(
    (extraction) => extraction.kind === 'selector'
  ) ?? []
  const valueExtractions = savedResult?.extractions.filter(
    (extraction) => extraction.kind !== 'selector'
  ) ?? []

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

      {savedResult && (
        <div className="recorder-saved-banner">
          Test recorded successfully: <code>{savedResult.outputPath}</code>
          <button
            className="btn btn-primary btn-sm recorder-saved-banner-action"
            onClick={() => navigate(`/project/${projectId}/explorer`)}
          >
            Open in Explorer
          </button>
        </div>
      )}

      {savedResult && (
        <div className="settings-section">
          <h3>Recorder Output Review</h3>
          <div className="recorder-summary-grid">
            <div className="recorder-summary-card">
              <span className="recorder-summary-value">{savedResult.testTitle}</span>
              <span className="recorder-summary-label">Test title</span>
            </div>
            <div className="recorder-summary-card">
              <span className="recorder-summary-value">{savedResult.actionCount}</span>
              <span className="recorder-summary-label">Awaited actions</span>
            </div>
            <div className="recorder-summary-card">
              <span className="recorder-summary-value">{selectorExtractions.length}</span>
              <span className="recorder-summary-label">Selector constants</span>
            </div>
            <div className="recorder-summary-card">
              <span className="recorder-summary-value">{valueExtractions.length}</span>
              <span className="recorder-summary-label">Value constants</span>
            </div>
          </div>

          {savedResult.appliedChanges.length > 0 && (
            <div className="recorder-review-block">
              <h4>Applied improvements</h4>
              <div className="recorder-chip-list">
                {savedResult.appliedChanges.map((change) => (
                  <span key={change} className="recorder-chip">
                    {change}
                  </span>
                ))}
              </div>
            </div>
          )}

          {savedResult.extractions.length > 0 && (
            <div className="recorder-review-block">
              <h4>Promoted constants</h4>
              <div className="recorder-extraction-list">
                {savedResult.extractions.map((extraction) => (
                  <RecorderExtractionRow key={`${extraction.kind}-${extraction.name}`} extraction={extraction} />
                ))}
              </div>
            </div>
          )}

          {savedResult.suggestions.length > 0 && (
            <div className="recorder-review-block">
              <h4>Suggested next edits</h4>
              <div className="recorder-suggestion-list">
                {savedResult.suggestions.map((suggestion) => (
                  <RecorderSuggestionCard
                    key={`${suggestion.kind}-${suggestion.title}`}
                    suggestion={suggestion}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="settings-section">
        <h3>Record a new test</h3>
        <p className="recorder-intro-copy">
          Playwright Codegen will open a browser. Interact with your app and close the browser when done, then the test will be saved automatically.
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
          <div className="recorder-field-hint">
            The default path follows your Playwright <code>testDir</code> so new recordings appear in Explorer immediately.
          </div>
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

function RecorderSuggestionCard({
  suggestion,
}: {
  suggestion: CodegenSuggestion
}): JSX.Element {
  return (
    <div className={`recorder-suggestion-card recorder-suggestion-${suggestion.kind}`}>
      <div className="recorder-suggestion-title">{suggestion.title}</div>
      <div className="recorder-suggestion-detail">{suggestion.detail}</div>
    </div>
  )
}

function RecorderExtractionRow({
  extraction,
}: {
  extraction: CodegenExtraction
}): JSX.Element {
  return (
    <div className="recorder-extraction-row">
      <div className="recorder-extraction-meta">
        <code>{extraction.name}</code>
        <span className="recorder-extraction-kind">{extraction.kind}</span>
      </div>
      <div className="recorder-extraction-value">{extraction.value}</div>
      <div className="recorder-extraction-count">{extraction.occurrences}x</div>
    </div>
  )
}
