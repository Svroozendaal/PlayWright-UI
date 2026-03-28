# SKILL: SQLite Migrations

## Purpose

Rules for database setup, schema versioning, and migration authoring in PW Studio using `better-sqlite3`.

## When to Use

- Any time the schema changes
- During server bootstrap and path resolution work

## Database Location

Store the database in the platform app-data directory used by the local server:

- Windows: `%APPDATA%/pw-studio/pw-studio.db`
- macOS: `~/Library/Application Support/pw-studio/pw-studio.db`
- Linux: `~/.config/pw-studio/pw-studio.db`

Always ensure the parent directory exists before opening the database.

## Open Pattern

```ts
export function openDatabase(): Database.Database {
  const dbPath = resolveUserDataPath('pw-studio.db')
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
```

## Rules

1. Migrations are append-only.
2. Every schema change gets a new migration.
3. Create `schema_version` before running migrations.
4. Run pending migrations in a single transaction.
5. Open the database once in the local server runtime.
6. Never use `better-sqlite3` in the renderer.
