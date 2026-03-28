import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'
import { getUserDataDir } from '../utils/paths'

export function openDatabase(): Database.Database {
  const dbPath = path.join(getUserDataDir(), 'pw-studio.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -64000')
  db.pragma('foreign_keys = ON')
  db.pragma('temp_store = MEMORY')

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  runMigrations(db)

  return db
}

export function closeDatabase(db: Database.Database): void {
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()
}
