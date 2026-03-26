# SKILL: SQLite Migrations

## Purpose

Rules for database setup, schema versioning, and migration authoring in PW Studio using better-sqlite3.

## When to Use

- Phase 1: Initial database bootstrap
- Phase 2, 4, 5: Adding new tables and columns
- Any time the schema needs to change

## Setup

**Package:** `better-sqlite3` (synchronous, single-connection, fast).

**Native module rebuilding required:**
```json
{
  "scripts": {
    "postinstall": "electron-rebuild",
    "rebuild": "electron-rebuild -f -w better-sqlite3"
  },
  "devDependencies": {
    "@electron/rebuild": "^3.x"
  }
}
```

**electron-builder config (for packaging):**
```json
{
  "build": {
    "files": ["!**/node_modules/better-sqlite3/build/Release/obj/**"],
    "asarUnpack": ["**/node_modules/better-sqlite3/**"]
  }
}
```

**CRITICAL:** `asarUnpack` is mandatory — native `.node` binaries cannot be loaded from inside an asar archive.

## Database Location

```typescript
import { app } from 'electron'
import path from 'path'
import Database from 'better-sqlite3'

const dbPath = path.join(app.getPath('userData'), 'pw-studio.db')
```

- `app.getPath('userData')` → `%APPDATA%/PW Studio` on Windows
- Only available after `app.whenReady()` resolves
- Ensure parent directory exists: `fs.mkdirSync(path.dirname(dbPath), { recursive: true })`
- Never put the database inside the app bundle (read-only, lost on updates)

## Database Open Pattern

```typescript
// src/main/db/database.ts
export function openDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'pw-studio.db')
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)

  // Recommended pragmas
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -64000')    // 64MB cache
  db.pragma('foreign_keys = ON')
  db.pragma('temp_store = MEMORY')

  // CRITICAL: create schema_version BEFORE running migrations
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  runMigrations(db)
  return db
}
```

**Why WAL mode:**
- Readers do not block writers and vice versa
- Better write performance
- Less corruption risk on crash
- Creates two additional files: `.db-wal` and `.db-shm` — must be kept alongside the main file

## Migration Runner

```typescript
// src/main/db/migrations.ts
type Migration = { version: number; up: (db: Database.Database) => void }

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE projects ( /* ... */ );
        CREATE TABLE app_settings ( /* ... */ );
      `)
    }
  },
  // Migration 2, 3, etc. appended here
]

export function runMigrations(db: Database.Database): void {
  const current = db
    .prepare('SELECT MAX(version) as v FROM schema_version')
    .get() as { v: number | null }
  const from = current.v ?? 0

  const pending = migrations.filter(m => m.version > from)
  if (pending.length === 0) return

  db.transaction(() => {
    for (const m of pending) {
      m.up(db)
      db.prepare('INSERT INTO schema_version VALUES (?, ?)').run(
        m.version, new Date().toISOString()
      )
    }
  })()
}
```

## Transaction Patterns

```typescript
// Batch operations — always wrap in transaction
const insertMany = db.transaction((items: Item[]) => {
  const insert = db.prepare('INSERT INTO items (name, value) VALUES (@name, @value)')
  for (const item of items) insert.run(item)
})
insertMany(items)

// Use .immediate() for write transactions to avoid SQLITE_BUSY
const writeTx = db.transaction(() => { /* writes */ })
writeTx.immediate()
```

## Graceful Shutdown

```typescript
app.on('before-quit', () => {
  db.pragma('wal_checkpoint(TRUNCATE)')
  db.close()
})
```

## Rules

1. **Migrations are append-only** — never edit an already-shipped migration.
2. **Every schema change = new migration** — even adding a column.
3. **`schema_version` table must exist before `runMigrations()`** — created in `openDatabase()`.
4. **Run all pending migrations in a single transaction** — if any fails, all roll back.
5. **Run migrations synchronously at startup** before opening any windows.
6. **Database opened once in main process only** — renderers access via IPC.
7. **Never use better-sqlite3 in renderer processes** — native modules in renderers cause packaging issues.
8. **`asarUnpack` in electron-builder config** — native binaries cannot load from asar.
