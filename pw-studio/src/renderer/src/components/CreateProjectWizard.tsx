import { useState } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, RegisteredProject, WizardParams } from '../../../shared/types/ipc'

type Step = 1 | 2 | 3 | 4

const BROWSERS = [
  { id: 'chromium', label: 'Chromium' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'webkit', label: 'WebKit' },
]

export function CreateProjectWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}): JSX.Element {
  const [step, setStep] = useState<Step>(1)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Step 1
  const [projectName, setProjectName] = useState('')
  const [rootPath, setRootPath] = useState('')

  // Step 2
  const [browsers, setBrowsers] = useState<string[]>(['chromium'])

  // Step 3
  const [includeExampleTests, setIncludeExampleTests] = useState(true)
  const [includeAuth, setIncludeAuth] = useState(false)
  const [includePageObjects, setIncludePageObjects] = useState(false)
  const [includeFixtures, setIncludeFixtures] = useState(false)

  const handlePickDirectory = async (): Promise<void> => {
    const result = await window.api.invoke<string | null>(IPC.DIALOG_OPEN_DIRECTORY)
    const envelope = result as IpcEnvelope<string | null>
    if (envelope.payload) {
      setRootPath(envelope.payload)
    }
  }

  const toggleBrowser = (id: string): void => {
    setBrowsers((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    )
  }

  const canProceed = (): boolean => {
    if (step === 1) return !!projectName.trim() && !!rootPath.trim()
    if (step === 2) return browsers.length > 0
    return true
  }

  const handleNext = (): void => {
    setError(null)
    if (step < 4) setStep((step + 1) as Step)
  }

  const handleBack = (): void => {
    setError(null)
    if (step > 1) setStep((step - 1) as Step)
  }

  const handleCreate = async (): Promise<void> => {
    setError(null)
    setCreating(true)

    const params: WizardParams = {
      projectName: projectName.trim(),
      rootPath: rootPath.trim(),
      browsers,
      includeExampleTests,
      includeAuth,
      includePageObjects,
      includeFixtures,
    }

    const result = await window.api.invoke<RegisteredProject>(IPC.PROJECTS_CREATE, params)
    const envelope = result as IpcEnvelope<RegisteredProject>

    if (envelope.error) {
      setCreating(false)
      if (envelope.error.code === 'PROJECT_EXISTS') {
        setError('This folder already contains a Playwright project. Would you like to import it instead?')
      } else {
        setError(envelope.error.message)
      }
      return
    }

    onCreated()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wizard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h3>New Project</h3>
          <div className="wizard-steps">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`wizard-step-dot ${s === step ? 'active' : ''} ${s < step ? 'done' : ''}`}
              >
                {s}
              </div>
            ))}
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {step === 1 && (
          <div className="wizard-content">
            <h4>Name &amp; Location</h4>
            <div className="form-group">
              <label>Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Playwright Project"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Project Folder</label>
              <div className="path-input">
                <input type="text" value={rootPath} readOnly placeholder="Select a folder..." />
                <button className="btn btn-secondary" onClick={handlePickDirectory}>
                  Browse
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-content">
            <h4>Browsers</h4>
            <p className="wizard-hint">Select the browsers to test against.</p>
            <div className="checkbox-group">
              {BROWSERS.map((b) => (
                <label key={b.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={browsers.includes(b.id)}
                    onChange={() => toggleBrowser(b.id)}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-content">
            <h4>Options</h4>
            <p className="wizard-hint">Choose what to include in your project.</p>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeExampleTests}
                  onChange={(e) => setIncludeExampleTests(e.target.checked)}
                />
                Example tests
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeAuth}
                  onChange={(e) => setIncludeAuth(e.target.checked)}
                />
                Authentication tests
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includePageObjects}
                  onChange={(e) => setIncludePageObjects(e.target.checked)}
                />
                Page objects
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={includeFixtures}
                  onChange={(e) => setIncludeFixtures(e.target.checked)}
                />
                Custom fixtures
              </label>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wizard-content">
            <h4>Confirm</h4>
            <div className="wizard-summary">
              <div className="summary-row">
                <span className="summary-label">Name:</span>
                <span>{projectName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Path:</span>
                <span className="summary-path">{rootPath}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Browsers:</span>
                <span>{browsers.join(', ')}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Options:</span>
                <span>
                  {[
                    includeExampleTests && 'examples',
                    includeAuth && 'auth',
                    includePageObjects && 'page objects',
                    includeFixtures && 'fixtures',
                  ]
                    .filter(Boolean)
                    .join(', ') || 'none'}
                </span>
              </div>
            </div>
            {creating && (
              <div className="wizard-progress">
                Creating project and installing dependencies...
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={step === 1 ? onClose : handleBack} disabled={creating}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button className="btn btn-primary" onClick={handleNext} disabled={!canProceed()}>
              Next
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
