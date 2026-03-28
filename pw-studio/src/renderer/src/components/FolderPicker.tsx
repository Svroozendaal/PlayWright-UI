import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { DirectoryBrowseResult } from '../../../shared/types/ipc'

type FolderPickerProps = {
  title?: string
  startPath?: string
  onClose: () => void
  onSelect: (selectedPath: string) => void
}

function pathSegments(currentPath: string): { label: string; path: string }[] {
  const normalized = currentPath.replace(/\\/g, '/')
  const driveMatch = normalized.match(/^[A-Za-z]:\//)
  const driveRoot = driveMatch?.[0]
  const remainingPath = driveRoot ? normalized.slice(driveRoot.length) : normalized
  const parts = remainingPath.split('/').filter(Boolean)
  const prefix = normalized.startsWith('/') ? '/' : ''
  const segments: { label: string; path: string }[] = []

  if (driveRoot) {
    segments.push({ label: driveRoot.replace('/', ''), path: driveRoot })
  } else if (prefix) {
    segments.push({ label: '/', path: '/' })
  }

  let runningPath = driveRoot ?? prefix

  for (const part of parts) {
    if (runningPath === '' || runningPath.endsWith('/')) {
      runningPath = `${runningPath}${part}`
    } else {
      runningPath = `${runningPath}/${part}`
    }

    segments.push({ label: part, path: runningPath })
  }

  return segments.length > 0 ? segments : [{ label: currentPath, path: currentPath }]
}

export function FolderPicker({
  title = 'Select Folder',
  startPath,
  onClose,
  onSelect,
}: FolderPickerProps): JSX.Element {
  const [result, setResult] = useState<DirectoryBrowseResult | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPath = async (nextPath?: string): Promise<void> => {
    setLoading(true)
    setError(null)

    const response = await api.browseDirectories(nextPath)
    if (response.error) {
      setError(response.error.message)
      setLoading(false)
      return
    }

    if (response.payload) {
      setResult(response.payload)
      setSelectedPath(response.payload.currentPath)
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadPath(startPath)
  }, [startPath])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal folder-picker-modal" onClick={(event) => event.stopPropagation()}>
        <div className="folder-picker-header">
          <h3>{title}</h3>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="folder-picker-breadcrumbs">
          {result &&
            pathSegments(result.currentPath).map((segment) => (
              <button
                key={segment.path}
                className="folder-picker-crumb"
                onClick={() => void loadPath(segment.path)}
              >
                {segment.label}
              </button>
            ))}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="folder-picker-current">
          <strong>Current folder:</strong> {result?.currentPath ?? 'Loading...'}
        </div>

        <div className="folder-picker-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => void loadPath(result?.parentPath ?? undefined)}
            disabled={!result?.parentPath || loading}
          >
            Up
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => selectedPath && onSelect(selectedPath)}
            disabled={!selectedPath || loading}
          >
            Select This Folder
          </button>
        </div>

        <div className="folder-picker-list">
          {loading ? (
            <div className="folder-picker-empty">Loading folders...</div>
          ) : result && result.entries.length > 0 ? (
            result.entries.map((entry) => (
              <button
                key={entry.path}
                className={`folder-picker-entry ${
                  selectedPath === entry.path ? 'folder-picker-entry-selected' : ''
                }`}
                onClick={() => {
                  if (entry.type === 'directory') {
                    setSelectedPath(entry.path)
                  }
                }}
                onDoubleClick={() => {
                  if (entry.type === 'directory') {
                    void loadPath(entry.path)
                  }
                }}
                disabled={entry.type !== 'directory'}
              >
                <span className="folder-picker-entry-name">
                  {entry.type === 'directory' ? '\u{1F4C1}' : '\u{1F4C4}'} {entry.name}
                </span>
                <span className="folder-picker-entry-type">{entry.type}</span>
              </button>
            ))
          ) : (
            <div className="folder-picker-empty">No entries found.</div>
          )}
        </div>
      </div>
    </div>
  )
}
