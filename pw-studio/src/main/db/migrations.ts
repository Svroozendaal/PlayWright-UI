import type Database from 'better-sqlite3'

type Migration = {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE projects (
          id                TEXT PRIMARY KEY,
          name              TEXT NOT NULL,
          rootPath          TEXT NOT NULL UNIQUE,
          source            TEXT NOT NULL CHECK(source IN ('created', 'imported')),
          createdAt         TEXT NOT NULL,
          updatedAt         TEXT NOT NULL,
          lastOpenedAt      TEXT,
          defaultBrowser    TEXT,
          activeEnvironment TEXT
        );

        CREATE TABLE app_settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE project_health_snapshots (
          projectId   TEXT NOT NULL,
          checkedAt   TEXT NOT NULL,
          status      TEXT NOT NULL CHECK(status IN ('healthy', 'warning', 'error')),
          payloadJson TEXT NOT NULL,
          PRIMARY KEY (projectId),
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );
      `)
    }
  },
  {
    version: 2,
    up: (db) => {
      db.exec(`
        CREATE TABLE runs (
          id              TEXT PRIMARY KEY,
          projectId       TEXT NOT NULL,
          status          TEXT NOT NULL CHECK(status IN ('queued', 'running', 'passed', 'failed', 'config-error', 'cancelled')),
          target          TEXT,
          targetPath      TEXT,
          browserJson     TEXT,
          environment     TEXT,
          headed          INTEGER NOT NULL DEFAULT 0,
          debug           INTEGER NOT NULL DEFAULT 0,
          commandJson     TEXT,
          exitCode        INTEGER,
          reportPath      TEXT,
          logPath         TEXT,
          resultsPath     TEXT,
          runDir          TEXT,
          startedAt       TEXT NOT NULL,
          finishedAt      TEXT,
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE run_test_results (
          id              TEXT PRIMARY KEY,
          runId           TEXT NOT NULL,
          testTitle       TEXT NOT NULL,
          status          TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'timedOut', 'skipped', 'interrupted')),
          duration        INTEGER,
          errorMessage    TEXT,
          tracePath       TEXT,
          screenshotPath  TEXT,
          videoPath       TEXT,
          retryCount      INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (runId) REFERENCES runs(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_runs_project ON runs(projectId, startedAt DESC);
        CREATE INDEX idx_run_results_run ON run_test_results(runId);
      `)
    }
  },
  {
    version: 3,
    up: (db) => {
      db.exec(`
        CREATE TABLE file_artifact_policies (
          id              TEXT PRIMARY KEY,
          projectId       TEXT NOT NULL,
          filePath        TEXT NOT NULL,
          screenshotMode  TEXT NOT NULL CHECK(screenshotMode IN ('off', 'on-failure', 'always')) DEFAULT 'on-failure',
          traceMode       TEXT NOT NULL CHECK(traceMode IN ('off', 'on-failure', 'always')) DEFAULT 'on-failure',
          videoMode       TEXT NOT NULL CHECK(videoMode IN ('off', 'on-failure', 'always')) DEFAULT 'off',
          UNIQUE(projectId, filePath),
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );

        ALTER TABLE runs ADD COLUMN parentRunId TEXT;
        ALTER TABLE run_test_results ADD COLUMN safeTitleForGrep TEXT;
      `)
    }
  },
  {
    version: 4,
    up: (db) => {
      db.exec(`
        CREATE TABLE test_flakiness (
          testTitle     TEXT NOT NULL,
          projectId     TEXT NOT NULL,
          totalRuns     INTEGER NOT NULL DEFAULT 0,
          totalPasses   INTEGER NOT NULL DEFAULT 0,
          totalFailures INTEGER NOT NULL DEFAULT 0,
          flakyCount    INTEGER NOT NULL DEFAULT 0,
          lastSeenAt    TEXT,
          PRIMARY KEY (projectId, testTitle),
          FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_flakiness_project ON test_flakiness(projectId, flakyCount DESC);
      `)
    }
  },
]

export function runMigrations(db: Database.Database): void {
  const current = db
    .prepare('SELECT MAX(version) as v FROM schema_version')
    .get() as { v: number | null } | undefined

  const from = current?.v ?? 0

  const pending = migrations.filter((m) => m.version > from)
  if (pending.length === 0) return

  db.transaction(() => {
    for (const m of pending) {
      m.up(db)
      db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(
        m.version,
        new Date().toISOString()
      )
    }
  })()
}
