import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IPC } from '../../../shared/types/ipc'
import type { IpcEnvelope, LoadedPluginSummary } from '../../../shared/types/ipc'
import { api } from '../api/client'

type PluginListPayload = {
  plugins: LoadedPluginSummary[]
}

export function PluginManagerPage(): JSX.Element {
  const navigate = useNavigate()
  const [plugins, setPlugins] = useState<LoadedPluginSummary[]>([])

  useEffect(() => {
    void (async () => {
      const result = await api.invoke<PluginListPayload>(IPC.PLUGINS_LIST)
      const envelope = result as IpcEnvelope<PluginListPayload>
      if (envelope.payload) {
        setPlugins(envelope.payload.plugins)
      }
    })()
  }, [])

  return (
    <div className="page-inner">
      <div className="page-header">
        <h2>Plugins</h2>
        <div className="page-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings/block-library')}>
            Open Block Library
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/settings')}>
            Back to Settings
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Installed Plugins</h3>
        {plugins.length === 0 ? (
          <p>No plugins are installed in the PW Studio plugin directories.</p>
        ) : (
          <div className="block-library-list">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="block-library-list-item">
                <span className="block-library-list-title">{plugin.name}</span>
                <span className="block-library-list-meta">
                  {plugin.id} · v{plugin.version} · {plugin.status}
                </span>
                {plugin.description && <span className="settings-value">{plugin.description}</span>}
                {plugin.capabilities.length > 0 && (
                  <span className="block-library-template-meta">
                    {plugin.capabilities.join(', ')}
                  </span>
                )}
                {plugin.error && <span className="error-text">{plugin.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
