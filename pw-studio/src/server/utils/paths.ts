import os from 'os'
import path from 'path'

const APP_DIR = 'pw-studio'

/**
 * Resolve the platform-specific application data directory for PW Studio.
 *
 * Returns:
 * Absolute directory path that should hold the local database and runtime data.
 */
export function getUserDataDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env['APPDATA'] || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, APP_DIR)
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_DIR)
  }

  return path.join(os.homedir(), '.config', APP_DIR)
}

/**
 * Resolve the default Documents directory used for suggested workspace paths.
 *
 * Returns:
 * Absolute path to the user's Documents directory.
 */
export function getDocumentsDir(): string {
  return path.join(os.homedir(), 'Documents')
}

/**
 * Resolve a file inside the user data directory.
 *
 * Params:
 * name - File name relative to the app data directory.
 *
 * Returns:
 * Absolute file path.
 */
export function resolveUserDataPath(name: string): string {
  return path.join(getUserDataDir(), name)
}
