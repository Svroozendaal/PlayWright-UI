import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, ProjectPluginList } from '../../../shared/types/ipc'
import { api } from '../api/client'

export function ProjectIntegrationsPage(): JSX.Element {
  const { id: projectId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [pluginState, setPluginState] = useState<ProjectPluginList>({ plugins: [] })
  const [savingPluginId, setSavingPluginId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) {
      return
    }

    void loadPlugins(projectId)
  }, [projectId])

  async function loadPlugins(id: string): Promise<void> {
    const result = await api.invoke<ProjectPluginList>(IPC.PROJECT_PLUGINS_LIST, { projectId: id })
    const envelope = result as IpcEnvelope<ProjectPluginList>
    if (envelope.payload) {
      setPluginState(envelope.payload)
    }
  }

  async function togglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    if (!projectId) {
      return
    }

    setSavingPluginId(pluginId)
    await api.invoke(IPC.PROJECT_PLUGIN_UPDATE, { projectId, pluginId, enabled })
    setSavingPluginId(null)
    await loadPlugins(projectId)
  }

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Integrations</h2>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings/plugins')}>
            Global Plugins
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/project/${projectId}/settings`)}>
            Back to Settings
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Enabled Plugins</h3>
        {pluginState.plugins.length === 0 ? (
          <p>No plugins are available.</p>
        ) : (
          <div className="block-library-availability-list">
            {pluginState.plugins.map((plugin) => (
              <label key={plugin.pluginId} className="block-library-availability-row">
                <span>
                  <strong>{plugin.manifest.name}</strong>
                  <span className="block-library-template-meta">
                    {plugin.manifest.id} · {plugin.manifest.status}
                  </span>
                  <span className="settings-value">{plugin.configPath}</span>
                </span>
                <input
                  type="checkbox"
                  checked={plugin.enabled}
                  disabled={savingPluginId === plugin.pluginId || plugin.manifest.status !== 'loaded'}
                  onChange={(event) => void togglePlugin(plugin.pluginId, event.target.checked)}
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
