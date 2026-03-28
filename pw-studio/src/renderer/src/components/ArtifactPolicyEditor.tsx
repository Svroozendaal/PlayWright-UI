import { useState, useEffect, useCallback } from 'react'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope } from '../../../shared/types/ipc'
import { api } from '../api/client'

type PolicyMode = 'off' | 'on-failure' | 'always'

type PolicyState = {
  screenshotMode: PolicyMode
  traceMode: PolicyMode
  videoMode: PolicyMode
}

type FilePolicy = {
  id: string
  projectId: string
  filePath: string
  screenshotMode: PolicyMode
  traceMode: PolicyMode
  videoMode: PolicyMode
}

export function ArtifactPolicyEditor({
  projectId,
  filePath,
}: {
  projectId: string
  filePath: string
}): JSX.Element {
  const [policy, setPolicy] = useState<PolicyState>({
    screenshotMode: 'on-failure',
    traceMode: 'on-failure',
    videoMode: 'off',
  })
  const [hasCustomPolicy, setHasCustomPolicy] = useState(false)

  const fetchPolicy = useCallback(async () => {
    const result = await api.invoke<FilePolicy | null>(IPC.EXPLORER_GET_FILE_POLICY, {
      projectId,
      filePath,
    })
    const envelope = result as IpcEnvelope<FilePolicy | null>
    if (envelope.payload) {
      setPolicy({
        screenshotMode: envelope.payload.screenshotMode,
        traceMode: envelope.payload.traceMode,
        videoMode: envelope.payload.videoMode,
      })
      setHasCustomPolicy(true)
    } else {
      setHasCustomPolicy(false)
    }
  }, [projectId, filePath])

  useEffect(() => {
    void fetchPolicy()
  }, [fetchPolicy])

  const handleChange = async (field: keyof PolicyState, value: PolicyMode): Promise<void> => {
    const newPolicy = { ...policy, [field]: value }
    setPolicy(newPolicy)
    setHasCustomPolicy(true)

    await api.invoke(IPC.EXPLORER_SET_FILE_POLICY, {
      projectId,
      filePath,
      policy: newPolicy,
    })
  }

  const handleReset = async (): Promise<void> => {
    // Delete the file-specific policy
    await api.invoke(IPC.EXPLORER_SET_FILE_POLICY, {
      projectId,
      filePath: '__delete__' + filePath,
      policy: { screenshotMode: 'on-failure', traceMode: 'on-failure', videoMode: 'off' },
    })
    setHasCustomPolicy(false)
    setPolicy({ screenshotMode: 'on-failure', traceMode: 'on-failure', videoMode: 'off' })
  }

  return (
    <div className="policy-editor">
      <h4>Artifact Policy</h4>
      {!hasCustomPolicy && (
        <div className="policy-default-label">Using project default</div>
      )}

      <div className="policy-row">
        <label>Screenshots</label>
        <select
          value={policy.screenshotMode}
          onChange={(e) => handleChange('screenshotMode', e.target.value as PolicyMode)}
          className="form-select"
        >
          <option value="off">Off</option>
          <option value="on-failure">On failure</option>
          <option value="always">Always</option>
        </select>
      </div>

      <div className="policy-row">
        <label>Traces</label>
        <select
          value={policy.traceMode}
          onChange={(e) => handleChange('traceMode', e.target.value as PolicyMode)}
          className="form-select"
        >
          <option value="off">Off</option>
          <option value="on-failure">On failure</option>
          <option value="always">Always</option>
        </select>
      </div>

      <div className="policy-row">
        <label>Video</label>
        <select
          value={policy.videoMode}
          onChange={(e) => handleChange('videoMode', e.target.value as PolicyMode)}
          className="form-select"
        >
          <option value="off">Off</option>
          <option value="on-failure">On failure</option>
          <option value="always">Always</option>
        </select>
      </div>

      {hasCustomPolicy && (
        <button className="btn btn-secondary" style={{ fontSize: 12, marginTop: 8 }} onClick={handleReset}>
          Reset to project default
        </button>
      )}
    </div>
  )
}
