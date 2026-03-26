import path from 'path'
import { ipcMain, app } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope, AppInfo } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerSettingsHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.SETTINGS_GET_APP_INFO,
    async (): Promise<IpcEnvelope<AppInfo>> => {
      try {
        const userDataPath = app.getPath('userData')
        const databasePath = path.join(userDataPath, 'pw-studio.db')
        const version = app.getVersion()
        return { version: 1, payload: { databasePath, version, userDataPath } }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.SETTINGS_GET,
    async (
      _event,
      envelope: { version: 1; payload?: { key: string } }
    ): Promise<IpcEnvelope<string | null>> => {
      try {
        const key = envelope.payload?.key ?? ''
        const value = services.settings.get(key)
        return { version: 1, payload: value }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.SETTINGS_SET,
    async (
      _event,
      envelope: { version: 1; payload?: { key: string; value: string } }
    ): Promise<IpcEnvelope<void>> => {
      try {
        const key = envelope.payload?.key ?? ''
        const value = envelope.payload?.value ?? ''
        services.settings.set(key, value)
        return { version: 1 }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
