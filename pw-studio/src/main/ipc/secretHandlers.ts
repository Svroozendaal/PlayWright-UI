import { ipcMain } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, MaskedSecret } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'
import { SecretsUnavailableError } from '../services/SecretsService'

export function registerSecretHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.SECRETS_SET,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; envName: string; key: string; value: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.envName || !p.key || !p.value) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId, envName, key and value are required' } }
        }
        await services.secrets.setSecret(p.projectId, p.envName, p.key, p.value)
        return { version: 1 }
      } catch (err) {
        if (err instanceof SecretsUnavailableError) {
          return { version: 1, error: { code: ERROR_CODES.SECRETS_UNAVAILABLE, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.SECRETS_GET_MASKED,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; envName: string } }
    ): Promise<IpcEnvelope<MaskedSecret[]>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.envName) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId and envName are required' } }
        }

        const project = services.projectRegistry.getProject(p.projectId)
        if (!project) {
          return { version: 1, error: { code: ERROR_CODES.PROJECT_NOT_FOUND, message: 'Project not found' } }
        }

        const envs = services.environment.listEnvironments(p.projectId, project.rootPath)
        const env = envs.find((e) => e.name === p.envName)
        if (!env) {
          return { version: 1, payload: [] }
        }

        const masked: MaskedSecret[] = Object.keys(env.secretRefs).map((key) => ({
          key,
          masked: '****',
        }))

        return { version: 1, payload: masked }
      } catch (err) {
        if (err instanceof SecretsUnavailableError) {
          return { version: 1, error: { code: ERROR_CODES.SECRETS_UNAVAILABLE, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.SECRETS_DELETE,
    async (
      _event,
      envelope: { version: 1; payload?: { projectId: string; envName: string; key: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const p = envelope.payload
        if (!p?.projectId || !p.envName || !p.key) {
          return { version: 1, error: { code: ERROR_CODES.INVALID_PATH, message: 'projectId, envName and key are required' } }
        }
        await services.secrets.deleteSecret(p.projectId, p.envName, p.key)
        return { version: 1 }
      } catch (err) {
        if (err instanceof SecretsUnavailableError) {
          return { version: 1, error: { code: ERROR_CODES.SECRETS_UNAVAILABLE, message: String(err) } }
        }
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
