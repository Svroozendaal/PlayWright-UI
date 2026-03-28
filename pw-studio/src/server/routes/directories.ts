import fs from 'fs'
import os from 'os'
import path from 'path'
import { z } from 'zod'
import { API_ROUTES, type DirectoryEntry } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getDocumentsDir } from '../utils/paths'

const browseDirectoriesBodySchema = z.object({
  path: z.string().optional(),
})

function getStartPath(requestedPath?: string): string {
  if (requestedPath && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isDirectory()) {
    return path.resolve(requestedPath)
  }

  const documentsDir = getDocumentsDir()
  if (fs.existsSync(documentsDir)) {
    return documentsDir
  }

  return path.resolve(os.homedir())
}

function getParentPath(currentPath: string): string | null {
  const parentPath = path.dirname(currentPath)
  return parentPath === currentPath ? null : parentPath
}

function listEntries(currentPath: string): DirectoryEntry[] {
  return fs
    .readdirSync(currentPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? ('directory' as const) : ('file' as const),
      path: path.join(currentPath, entry.name),
    }))
    .sort((a, b) => {
      if (a.type === 'directory' && b.type !== 'directory') return -1
      if (a.type !== 'directory' && b.type === 'directory') return 1
      return a.name.localeCompare(b.name)
    })
}

export const directoryRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.DIRECTORIES_BROWSE,
    tags: ['Directories'],
    summary: 'Browse filesystem entries for the in-app folder picker',
    operationId: 'browseDirectories',
    schemas: { body: browseDirectoriesBodySchema },
    handler: ({ body }) => {
      const currentPath = getStartPath((body as { path?: string }).path)
      return {
        currentPath,
        parentPath: getParentPath(currentPath),
        entries: listEntries(currentPath),
      }
    },
  },
]
