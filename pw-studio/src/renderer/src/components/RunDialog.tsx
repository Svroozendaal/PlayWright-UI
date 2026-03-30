import { useState, useEffect } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type {
  FlowInputDefinition,
  IpcEnvelope,
  RunRequest,
  BrowserSelection,
  Environment,
  ProjectConfigSummary,
  RegisteredProject,
  TestCaseRef,
  TestEditorDocument,
} from '../../../shared/types/ipc'
import { api } from '../api/client'
import { ErrorBanner } from './ErrorBanner'

type RunDialogProps = {
  projectId: string
  targetPath?: string
  target?: string
  testTitleFilter?: string
  testCaseRef?: TestCaseRef
  onClose: () => void
  onStarted: (runId: string) => void
}

export function RunDialog({
  projectId,
  targetPath,
  target,
  testTitleFilter,
  testCaseRef,
  onClose,
  onStarted,
}: RunDialogProps): JSX.Element {
  const [projects, setProjects] = useState<string[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [selectedBrowser, setSelectedBrowser] = useState<string>('all')
  const [selectedEnv, setSelectedEnv] = useState<string>('')
  const [headed, setHeaded] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [baseURL, setBaseURL] = useState('')
  const [grepPattern, setGrepPattern] = useState('')
  const [grepInvert, setGrepInvert] = useState(false)
  const [tagFilter, setTagFilter] = useState('')
  const [exposedFlowInputs, setExposedFlowInputs] = useState<FlowInputDefinition[]>([])
  const [flowInputValues, setFlowInputValues] = useState<Record<string, string>>({})
  const [loadingFlowInputs, setLoadingFlowInputs] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchConfig = async (): Promise<void> => {
      const result = await api.invoke<ProjectConfigSummary>(IPC.HEALTH_GET_CONFIG, { projectId })
      const envelope = result as IpcEnvelope<ProjectConfigSummary>
      if (envelope.payload?.projects) {
        setProjects(envelope.payload.projects)
      }
    }

    const fetchEnvironments = async (): Promise<void> => {
      const result = await api.invoke<Environment[]>(IPC.ENVIRONMENTS_LIST, { projectId })
      const envelope = result as IpcEnvelope<Environment[]>
      if (envelope.payload) setEnvironments(envelope.payload)
    }

    const fetchProjectDefaults = async (): Promise<void> => {
      const result = await api.invoke<RegisteredProject>(IPC.PROJECTS_GET, { id: projectId })
      const envelope = result as IpcEnvelope<RegisteredProject>
      if (envelope.payload) {
        if (envelope.payload.defaultBrowser) setSelectedBrowser(envelope.payload.defaultBrowser)
        if (envelope.payload.activeEnvironment) setSelectedEnv(envelope.payload.activeEnvironment)
      }
    }

    void fetchConfig()
    void fetchEnvironments()
    void fetchProjectDefaults()
  }, [projectId])

  useEffect(() => {
    if (!targetPath || !testCaseRef) {
      setExposedFlowInputs([])
      setFlowInputValues({})
      setLoadingFlowInputs(false)
      return
    }

    let cancelled = false

    const fetchFlowInputs = async (): Promise<void> => {
      setLoadingFlowInputs(true)
      const result = await api.invoke<TestEditorDocument>(IPC.TEST_EDITOR_LOAD, {
        projectId,
        filePath: targetPath,
        mode: 'existing',
        testCaseRef,
      })
      if (cancelled) {
        return
      }

      const envelope = result as IpcEnvelope<TestEditorDocument>
      const nextInputs = (envelope.payload?.flowInputs ?? []).filter((input) => input.exposeAtRunStart)
      setExposedFlowInputs(nextInputs)
      setFlowInputValues(
        Object.fromEntries(nextInputs.map((input) => [input.name, input.defaultValue]))
      )
      setLoadingFlowInputs(false)
    }

    void fetchFlowInputs()

    return () => {
      cancelled = true
    }
  }, [projectId, targetPath, testCaseRef?.ordinal, testCaseRef?.testTitle])

  const handleStart = async (): Promise<void> => {
    setError(null)
    setStarting(true)

    const browser: BrowserSelection =
      selectedBrowser === 'all'
        ? { mode: 'all' }
        : { mode: 'single', projectName: selectedBrowser }

    const request: RunRequest = {
      projectId,
      target,
      targetPath,
      testTitleFilter,
      grepPattern: grepPattern || undefined,
      grepInvert: grepInvert || undefined,
      tagFilter: tagFilter || undefined,
      browser,
      environment: selectedEnv || undefined,
      headed,
      baseURLOverride: baseURL || undefined,
      streamLogs: true,
      flowInputOverrides:
        exposedFlowInputs.length > 0
          ? Object.fromEntries(
              exposedFlowInputs.map((input) => [
                input.name,
                flowInputValues[input.name] ?? input.defaultValue,
              ])
            )
          : undefined,
    }

    const result = await api.invoke<string>(IPC.RUNS_START, request)
    const envelope = result as IpcEnvelope<string>

    setStarting(false)

    if (envelope.error) {
      setError(envelope.error)
      return
    }

    if (envelope.payload) {
      onStarted(envelope.payload)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Run Tests</h3>

        {error && (
          <ErrorBanner code={error.code} message={error.message} />
        )}

        {targetPath && (
          <div className="form-group">
            <label>Target</label>
            <input type="text" value={targetPath} readOnly />
          </div>
        )}

        {testTitleFilter && (
          <div className="form-group">
            <label>Test Filter</label>
            <input type="text" value={testTitleFilter} readOnly />
          </div>
        )}

        {testCaseRef && (
          <div className="form-group">
            <label>Flow inputs</label>
            {loadingFlowInputs ? (
              <div className="settings-value">Loading flow inputs...</div>
            ) : exposedFlowInputs.length === 0 ? (
              <div className="settings-value">This flow uses saved defaults only.</div>
            ) : (
              <div className="test-editor-flow-input-list">
                {exposedFlowInputs.map((input) => (
                  <label key={input.id}>
                    {input.name}
                    <input
                      type="text"
                      value={flowInputValues[input.name] ?? ''}
                      onChange={(e) =>
                        setFlowInputValues((current) => ({
                          ...current,
                          [input.name]: e.target.value,
                        }))
                      }
                      placeholder={input.defaultValue}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label>Browser</label>
          <select
            value={selectedBrowser}
            onChange={(e) => setSelectedBrowser(e.target.value)}
            className="form-select"
          >
            <option value="all">All browsers</option>
            {projects.length > 0 ? (
              projects.map((p) => (
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

        {environments.length > 0 && (
          <div className="form-group">
            <label>Environment</label>
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="form-select"
            >
              <option value="">None</option>
              {environments.map((env) => (
                <option key={env.name} value={env.name}>{env.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={headed}
              onChange={(e) => setHeaded(e.target.checked)}
            />
            Headed mode
          </label>
        </div>

        <button
          className="btn btn-secondary"
          style={{ fontSize: 12, marginBottom: 12 }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
        </button>

        {showAdvanced && (
          <>
            <div className="form-group">
              <label>Base URL override</label>
              <input
                type="text"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder="http://localhost:3000"
              />
            </div>

            <div className="form-group">
              <label>Grep filter</label>
              <input
                type="text"
                value={grepPattern}
                onChange={(e) => setGrepPattern(e.target.value)}
                placeholder="e.g. login|signup"
              />
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={grepInvert}
                  onChange={(e) => setGrepInvert(e.target.checked)}
                />
                Invert grep (exclude matching tests)
              </label>
            </div>

            <div className="form-group">
              <label>Tag filter</label>
              <input
                type="text"
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                placeholder="e.g. @smoke"
              />
            </div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={starting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleStart} disabled={starting}>
            {starting ? 'Starting...' : 'Run'}
          </button>
        </div>
      </div>
    </div>
  )
}
