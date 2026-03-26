import { ipcMain, dialog } from 'electron'
import { IPC, ERROR_CODES } from '../../shared/types/ipc'
import type { IpcEnvelope } from '../../shared/types/ipc'
import type { ServiceContainer } from '../services/ServiceContainer'

export function registerDialogHandlers(services: ServiceContainer): void {
  ipcMain.handle(
    IPC.DIALOG_OPEN_DIRECTORY,
    async (): Promise<IpcEnvelope<string | null>> => {
      try {
        const result = await dialog.showOpenDialog(services.win, {
          properties: ['openDirectory'],
        })

        if (result.canceled || result.filePaths.length === 0) {
          return { version: 1, payload: null }
        }

        return { version: 1, payload: result.filePaths[0] ?? null }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )

  ipcMain.handle(
    IPC.DIALOG_SAVE_FILE,
    async (
      _event,
      envelope: { version: 1; payload?: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] } }
    ): Promise<IpcEnvelope<string | null>> => {
      try {
        const result = await dialog.showSaveDialog(services.win, {
          defaultPath: envelope.payload?.defaultPath,
          filters: envelope.payload?.filters ?? [
            { name: 'TypeScript', extensions: ['ts'] },
            { name: 'JavaScript', extensions: ['js'] },
          ],
        })

        if (result.canceled || !result.filePath) {
          return { version: 1, payload: null }
        }

        return { version: 1, payload: result.filePath }
      } catch (err) {
        return { version: 1, error: { code: ERROR_CODES.UNKNOWN, message: String(err) } }
      }
    }
  )
}
