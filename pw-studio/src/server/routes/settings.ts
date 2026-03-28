import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { resolveUserDataPath, getUserDataDir } from '../utils/paths'

const settingKeyParamSchema = z.object({
  key: z.string().min(1),
})

const settingValueBodySchema = z.object({
  value: z.string(),
})

function getPackageVersion(): string {
  try {
    const packageJsonPath = path.resolve(process.cwd(), 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
      version?: string
    }
    return packageJson.version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const settingsRoutes: RouteDefinition[] = [
  {
    method: 'get',
    path: API_ROUTES.SETTINGS_GET_APP_INFO,
    tags: ['Settings'],
    summary: 'Get app runtime info',
    operationId: 'getAppInfo',
    handler: () => ({
      databasePath: resolveUserDataPath('pw-studio.db'),
      version: getPackageVersion(),
      userDataPath: getUserDataDir(),
    }),
  },
  {
    method: 'get',
    path: API_ROUTES.SETTINGS_GET,
    tags: ['Settings'],
    summary: 'Get a stored app setting',
    operationId: 'getSetting',
    schemas: { params: settingKeyParamSchema },
    handler: ({ services, params }) => services.settings.get((params as { key: string }).key),
  },
  {
    method: 'put',
    path: API_ROUTES.SETTINGS_SET,
    tags: ['Settings'],
    summary: 'Set a stored app setting',
    operationId: 'setSetting',
    schemas: {
      params: settingKeyParamSchema,
      body: settingValueBodySchema,
    },
    handler: ({ services, params, body }) => {
      services.settings.set((params as { key: string }).key, (body as { value: string }).value)
      return undefined
    },
  },
]
