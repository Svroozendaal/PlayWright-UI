import path from 'path'
import fs from 'fs'
import { app } from 'electron'
import Database from 'better-sqlite3'
import { runMigrations } from './migrations'

export function openDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'pw-studio.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)

  // Recommended pragmas for Electron + SQLite
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -64000')
  db.pragma('foreign_keys = ON')
  db.pragma('temp_store = MEMORY')

  // CRITICAL: create schema_version table BEFORE running migrations.
  // The migration runner does SELECT MAX(version) — the table must exist.
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
