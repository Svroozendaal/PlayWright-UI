import path from 'path'
import type Database from 'better-sqlite3'
import { getDocumentsDir } from '../utils/paths'

export class SettingsService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
    this.ensureDefaults()
  }

  private ensureDefaults(): void {
    const defaultWorkspace = this.get('defaultWorkspacePath')
    if (!defaultWorkspace) {
      this.set('defaultWorkspacePath', path.join(getDocumentsDir(), 'PW Studio'))
    }
  }

  get(key: string): string | null {
    const row = this.db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .get(key) as { value: string } | undefined

    if (!row) return null

    try {
      return JSON.parse(row.value) as string
    } catch {
      return row.value
    }
  }

  set(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
      )
      .run(key, JSON.stringify(value), JSON.stringify(value))
  }
}
