# PW Studio — Complete Architecture Blueprint v1
> Versie 1.2 — gaps resolved
> Minimale Node-versie (system): 18.x | Minimale Playwright-versie: 1.40.0

---

## 1. Productdoel

PW Studio v1 is een lokale Electron desktop-app die Playwright Test omhult met een GUI.
Geen alternatief voor Playwright — een orchestratielaag eromheen.

---

## 2. Kernprincipes

**Registry, geen centrale opslag**
De app beheert paden en metadata. Projectmappen worden niet verplaatst.
Geïmporteerde projecten blijven op hun bestaande locatie.

**CLI-first via lokale binary**
Gebruik altijd `node_modules/.bin/playwright` (of `.cmd` op Windows).
Gebruik NOOIT `npx playwright` — npx pakt niet gegarandeerd de lokale versie.
Op Windows: binary is `playwright.cmd`, spawn met `shell: false`.
`--reporter=json` is de vaste parseerbare output in v1.

**Graceful degradation**
Filesystem tree werkt altijd. Test file detection werkt meestal.
Testcase-extractie mag falen zonder dat de explorer stukgaat.

**File watching als fundament**
chokidar watchers zijn kerninfrastructuur. Watcher meldt events, indexer doet parsing.
Wijzigingen in `environments/` en `playwright.config.*` triggeren ook cache-invalidatie.

**Security via OS secure storage**
Secrets via keytar (OS keychain). JSON-bestanden bevatten alleen secretRefs.
Geen custom encryptie. Geen plaintext fallback — keychain-fout = expliciete error.

**Vroeg risico valideren**
Run engine PoC parallel aan Explorer Phase 3.

---

## 3. Stack

| Laag | Technologie |
|---|---|
| Desktop shell | Electron |
| UI | React + TypeScript |
| Backend/services | Node.js + TypeScript (main process) |
| Database | SQLite (better-sqlite3) |
| File watching | chokidar |
| Secrets | keytar (OS keychain) |
| Automation | Lokale Playwright binary |
| Packaging | electron-builder |

---

## 4. IPC Architectuur

### Twee soorten communicatie

**1. Request/response** — alle gewone acties
`window.api.invoke(channel, payload)` → `ipcMain.handle()` → eenmalig antwoord

**2. Event stream** — log streaming en status-push
`webContents.send()` vanuit main → renderer luistert via `window.api.on()`
Renderer meldt zich altijd af via `window.api.off()` bij component unmount

### Preload script

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  invoke: <T>(channel: string, payload?: unknown): Promise<IpcEnvelope<T>> =>
    ipcRenderer.invoke(channel, { version: 1, payload }),

  on: (channel: string, handler: (data: unknown) => void): void => {
    ipcRenderer.on(channel, (_e, data) => handler(data))
  },

  off: (channel: string, handler: (data: unknown) => void): void => {
    ipcRenderer.removeListener(channel, handler)
  },
})
```

### IpcEnvelope type

```typescript
// src/shared/types/ipc.ts
export type IpcEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}
```

### IPC channels (constanten)

```typescript
export const IPC = {
  PROJECTS_LIST:            'projects:list',
  PROJECTS_CREATE:          'projects:create',
  PROJECTS_IMPORT:          'projects:import',
  PROJECTS_GET:             'projects:get',
  PROJECTS_OPEN:            'projects:open',
  PROJECTS_REMOVE:          'projects:remove',
  HEALTH_GET:               'health:get',
  HEALTH_REFRESH:           'health:refresh',
  EXPLORER_GET_TREE:        'explorer:getTree',
  EXPLORER_REFRESH:         'explorer:refresh',
  EXPLORER_GET_FILE_POLICY: 'explorer:getFilePolicy',
  EXPLORER_SET_FILE_POLICY: 'explorer:setFilePolicy',
  RUNS_START:               'runs:start',
  RUNS_GET_ACTIVE:          'runs:getActive',
  RUNS_LIST:                'runs:list',
  RUNS_GET_BY_ID:           'runs:getById',
  RUNS_CANCEL:              'runs:cancel',
  RUNS_RERUN:               'runs:rerun',
  RUNS_RERUN_FAILED:        'runs:rerunFailed',
  RUNS_LOG_EVENT:           'runs:logEvent',       // push: main → renderer
  RUNS_STATUS_CHANGED:      'runs:statusChanged',  // push: main → renderer
  ENVIRONMENTS_LIST:        'environments:list',
  ENVIRONMENTS_CREATE:      'environments:create',
  ENVIRONMENTS_UPDATE:      'environments:update',
  ENVIRONMENTS_DELETE:      'environments:delete',
  ENVIRONMENTS_CHANGED:     'environments:changed', // push bij watcher-event
  SECRETS_SET:              'secrets:set',
  SECRETS_GET_MASKED:       'secrets:getMasked',
  SECRETS_DELETE:           'secrets:delete',
  RECORDER_START:           'recorder:start',
  RECORDER_STOP:            'recorder:stop',
  RECORDER_SAVE:            'recorder:save',
  RECORDER_STATUS:          'recorder:status',     // push
  ARTIFACTS_LIST_BY_RUN:    'artifacts:listByRun',
  ARTIFACTS_OPEN:           'artifacts:open',
  ARTIFACTS_OPEN_REPORT:    'artifacts:openReport',
} as const
```

### Log streaming protocol

```typescript
type LogEvent = {
  runId: string
  line: string
  timestamp: string   // ISO 8601
  source: 'stdout' | 'stderr'
}

type RunStatusEvent = {
  runId: string
  status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled'
  finishedAt?: string
}
```

**Lifecycle:**
1. Renderer: `invoke(RUNS_START)` → ontvangt runId
2. Renderer: `on(RUNS_LOG_EVENT, handler)` direct na start
3. Main: pusht LogEvent per stdout/stderr-regel
4. Main: pusht RunStatusEvent bij run-einde
5. Renderer: ontvangt RunStatusEvent → `off(RUNS_LOG_EVENT, handler)`
6. Renderer: altijd `off()` in useEffect cleanup bij unmount

**Cancel flow (volgorde verplicht):**
```
Renderer → invoke(RUNS_CANCEL, { runId })
Main:
  1. process.kill('SIGTERM')
  2. wacht max 3s op 'close' event
  3. zo nodig: process.kill('SIGKILL')
  4. run.status = 'cancelled' opslaan in SQLite
  5. webContents.send(RUNS_STATUS_CHANGED, { runId, status: 'cancelled' })
Renderer → ontvangt StatusEvent → stopt log listener
```


---

## 5. SQLite Migrations

### Schema versie tabel

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER NOT NULL,
  applied_at TEXT NOT NULL
);
```

### Migration runner

```typescript
// src/main/db/migrations.ts
type Migration = { version: number; up: (db: Database) => void }

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => { /* projects, app_settings, project_health_snapshots */ }
  },
  {
    version: 2,
    up: (db) => { /* runs, run_test_results */ }
  },
  {
    version: 3,
    up: (db) => {
      /* file_artifact_policies */
      /* ALTER TABLE runs ADD COLUMN parentRunId TEXT */
      /* ALTER TABLE run_test_results ADD COLUMN safeTitleForGrep TEXT */
    }
  },
]

export function runMigrations(db: Database): void {
  const current = db
    .prepare('SELECT MAX(version) as v FROM schema_version')
    .get() as { v: number | null }
  const from = current.v ?? 0
  for (const m of migrations.filter(m => m.version > from)) {
    db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO schema_version VALUES (?, ?)').run(
        m.version, new Date().toISOString()
      )
    })()
  }
}
```

**Regel:** Elke schema-wijziging (ook kolom toevoegen) = nieuwe migration. Nooit het initiële schema wijzigen.

---

## 6. `.pwstudio/project.json`

Leeft in de projectmap. App-specifieke metadata die bij het project hoort, niet bij de app-installatie.

```typescript
type PwStudioProjectConfig = {
  schemaVersion: 1
  createdAt: string
  explorer: {
    expandedPaths: string[]
    hiddenPaths: string[]
  }
  presets: RunPreset[]
}

type RunPreset = {
  id: string
  name: string                  // bijv. "Smoke on staging"
  targetType: 'all' | 'folder' | 'file' | 'test'
  targetPath?: string
  browser: string
  environmentName?: string
  overrides?: Partial<RunOverrides>
}
```

### Source of truth per gegeven

| Gegeven | Waar |
|---|---|
| Projectnaam, rootPath, lastOpenedAt | SQLite `projects` |
| Explorer fold-state, presets | `.pwstudio/project.json` |
| Environments, variabelen | `environments/*.json` |
| Secrets | OS keychain |
| Run history, testresultaten | SQLite |
| Artifact policies | SQLite |

### Reconciliatie

- `.pwstudio/project.json` ontbreekt bij import → aanmaken met defaults
- `activeEnvironment` in SQLite verwijst naar niet-bestaand JSON-bestand → reset naar `null`, toon banner "Actieve environment niet gevonden"

### Active environment UX

- Eén actieve environment per project, opgeslagen als `projects.activeEnvironment`
- Wordt **standaard** gebruikt bij elke run
- Wijzigen via dropdown in het project dashboard → direct effect, geen herstart nodig
- Per run tijdelijk overschrijven via run dialog → wijzigt de project-instelling **niet**
- Als `activeEnvironment = null` → run zonder environment (geen baseURL, geen extra vars injected)

---

## 7. Playwright Binary Detectie

```typescript
// src/main/utils/playwrightBinary.ts
import path from 'path'
import { spawn, execFileSync } from 'child_process'

export function getPlaywrightBinary(rootPath: string): string {
  const isWindows = process.platform === 'win32'
  return path.join(
    rootPath, 'node_modules', '.bin',
    isWindows ? 'playwright.cmd' : 'playwright'
  )
}

export function spawnPlaywright(
  args: string[],
  rootPath: string,
  extraEnv?: Record<string, string>
) {
  return spawn(getPlaywrightBinary(rootPath), args, {
    cwd: rootPath,
    shell: false,
    env: { ...process.env, ...extraEnv },
  })
}

export function getPlaywrightVersion(rootPath: string): string {
  // Output: "Version 1.45.0"
  const out = execFileSync(
    getPlaywrightBinary(rootPath), ['--version'],
    { cwd: rootPath, encoding: 'utf8' }
  )
  const match = out.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1] : 'unknown'
}
```

---

## 8. Dynamisch `testDir` Lezen uit Playwright Config

De app leest `testDir` dynamisch uit `playwright.config.ts` van elk project. De hardcoded aanname `tests/` wordt nergens gebruikt — `testDir` is altijd de geresolvede waarde uit de config.

### Leesaanpak

Playwright config-bestanden zijn TypeScript en kunnen niet met een simpele JSON-parser worden gelezen. De aanpak in v1:

```typescript
// src/main/utils/playwrightConfigReader.ts
import path from 'path'
import { execFileSync } from 'child_process'

export type PlaywrightConfigSummary = {
  testDir: string           // absoluut pad
  projects: string[]        // lijst van project-namen (browser configs)
  outputDir: string         // absoluut pad, default: test-results/
}

export function readPlaywrightConfig(rootPath: string): PlaywrightConfigSummary {
  // Gebruik een klein Node-script dat de config importeert en de relevante
  // velden als JSON naar stdout schrijft. Dit draait in de projectomgeving
  // zodat eventuele imports in de config gewoon werken.
  const extractorScript = buildExtractorScript()
  const output = execFileSync(
    process.execPath,   // system Node (niet Electron's bundeled Node)
    ['--input-type=module'],
    {
      input: extractorScript,
      cwd: rootPath,
      encoding: 'utf8',
      env: { ...process.env, PWSTUDIO_EXTRACT: '1' },
    }
  )
  return JSON.parse(output)
}

function buildExtractorScript(): string {
  // Importeer de config dynamisch en extraheer de benodigde velden
  return `
import { pathToFileURL } from 'url';
import path from 'path';

const configFiles = ['playwright.config.ts', 'playwright.config.js', 'playwright.config.mjs'];
let config = null;
for (const f of configFiles) {
  try {
    const mod = await import(pathToFileURL(path.resolve(f)).href);
    config = mod.default ?? mod;
    break;
  } catch {}
}

const testDir = path.resolve(config?.testDir ?? 'tests');
const outputDir = path.resolve(config?.outputDir ?? 'test-results');
const projects = (config?.projects ?? []).map(p => p.name).filter(Boolean);

process.stdout.write(JSON.stringify({ testDir, projects, outputDir }));
`
}
```

**Fallback:** Als de config niet leesbaar is (parse-fout, ontbrekend bestand):
- `testDir` → `path.join(rootPath, 'tests')` als fallback
- Toon een warning in het Health Panel: "Kon playwright.config.ts niet lezen — testDir valt terug op 'tests/'"
- De app blijft functioneel

### Waar `testDir` wordt gebruikt

| Component | Gebruik |
|---|---|
| `ProjectHealthService` | Health check `testsFolder` controleert `configSummary.testDir` i.p.v. hardcoded `tests/` |
| `FileWatchService` | Watch target is `configSummary.testDir` i.p.v. `tests/` |
| `ProjectIndexService` | Explorer root start bij `configSummary.testDir` |
| `RecorderService` | Directory picker voor output beperkt tot `configSummary.testDir` |
| `CommandBuilder` | `--output` voor artifacts gaat naar `configSummary.outputDir` |

### `configSummary` cachen

`readPlaywrightConfig()` is relatief zwaar (spawnt een Node-process). Cache de uitkomst in memory per project. Invalideert als `playwright.config.*` wijzigt (FileWatchService meldt dit al).

```typescript
// ProjectHealthService of aparte PlaywrightConfigService
private configCache = new Map<string, { summary: PlaywrightConfigSummary; cachedAt: number }>()

getConfigSummary(projectId: string, rootPath: string): PlaywrightConfigSummary {
  const cached = this.configCache.get(projectId)
  if (cached && Date.now() - cached.cachedAt < 60_000) return cached.summary
  const summary = readPlaywrightConfig(rootPath)
  this.configCache.set(projectId, { summary, cachedAt: Date.now() })
  return summary
}

invalidateConfigCache(projectId: string): void {
  this.configCache.delete(projectId)
}
```

`projects[]` uit de config is de lijst van Playwright-projectnamen (browser-configuraties). Dit wordt gebruikt voor de browser-dropdown in de run dialog.

---

## 9. Playwright JSON Reporter Output & Parser

### Output formaat (vereenvoudigd)

```typescript
type PlaywrightJsonReport = {
  config: { rootDir: string }
  suites: PlaywrightSuite[]
  stats: { expected: number; skipped: number; unexpected: number }
}

type PlaywrightSuite = {
  title: string
  file: string                  // absoluut pad
  suites?: PlaywrightSuite[]    // geneste describe-blokken
  specs: PlaywrightSpec[]
}

type PlaywrightSpec = {
  title: string
  tests: PlaywrightTest[]
}

type PlaywrightTest = {
  status: 'expected' | 'unexpected' | 'skipped' | 'flaky'
  results: PlaywrightTestResult[]
}

type PlaywrightTestResult = {
  status: 'passed' | 'failed' | 'timedOut' | 'skipped'
  duration: number
  retry: number
  error?: { message: string; stack?: string }
  attachments: { name: string; path?: string; contentType: string }[]
}
```

### Parser

```typescript
// src/main/services/RunResultParser.ts
export function parseJsonReport(
  reportPath: string,
  runId: string
): RunTestResultRow[] {
  const report: PlaywrightJsonReport = JSON.parse(
    fs.readFileSync(reportPath, 'utf8')
  )
  const results: RunTestResultRow[] = []

  function processSuite(suite: PlaywrightSuite, filePath: string) {
    for (const spec of suite.specs) {
      const lastResult = spec.tests[0]?.results.at(-1)
      if (!lastResult) continue
      results.push({
        id: crypto.randomUUID(),
        runId,
        filePath,
        testTitle: spec.title,
        safeTitleForGrep: spec.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        status: mapStatus(lastResult.status),
        durationMs: lastResult.duration,
        retryCount: lastResult.retry,
        errorMessage: lastResult.error?.message,
        tracePath:      lastResult.attachments.find(a => a.name === 'trace')?.path,
        screenshotPath: lastResult.attachments.find(a => a.name === 'screenshot')?.path,
        videoPath:      lastResult.attachments.find(a => a.name === 'video')?.path,
      })
    }
    for (const child of suite.suites ?? []) processSuite(child, filePath)
  }

  for (const suite of report.suites) processSuite(suite, suite.file)
  return results
}

function mapStatus(s: string): RunTestResultRow['status'] {
  if (s === 'passed') return 'passed'
  if (s === 'failed') return 'failed'
  if (s === 'timedOut') return 'timedOut'
  return 'skipped'
}
```

---

## 10. Artifact Policy → CLI Flags Mapping

App-interne modes verschillen van Playwright CLI-flags. Exacte mapping:

| App mode | `--screenshot=` | `--video=` | `--trace=` |
|---|---|---|---|
| `'off'` | `off` | `off` | `off` |
| `'on-failure'` | `only-on-failure` | `retain-on-failure` | `retain-on-failure` |
| `'always'` | `on` | `on` | `on` |

```typescript
// src/main/services/CommandBuilder.ts
function buildArtifactFlags(policy: ResolvedArtifactPolicy): string[] {
  const ssMap  = { 'off': 'off', 'on-failure': 'only-on-failure',    'always': 'on' }
  const vidMap = { 'off': 'off', 'on-failure': 'retain-on-failure',  'always': 'on' }
  const trMap  = { 'off': 'off', 'on-failure': 'retain-on-failure',  'always': 'on' }
  return [
    `--screenshot=${ssMap[policy.screenshotMode]}`,
    `--video=${vidMap[policy.videoMode]}`,
    `--trace=${trMap[policy.traceMode]}`,
  ]
}
```

---

## 11. rerunFailed — Grep Strategie

```typescript
function buildRerunFailedArgs(
  originalRun: RunRow,
  failedResults: RunTestResultRow[]
): string[] {
  if (failedResults.length === 0) throw new Error('Geen mislukte tests')

  const grepPattern = failedResults
    .map(r => r.safeTitleForGrep)
    .join('|')

  const browser: BrowserSelection = JSON.parse(originalRun.browserJson)
  const browserArgs = browser.mode === 'single'
    ? [`--project=${browser.projectName}`]
    : []   // mode 'all' → geen --project flag

  return [
    'test',
    `--grep=${grepPattern}`,
    ...browserArgs,
    '--reporter=json', '--reporter=html',
  ]
}
```

**Edge cases:**
- Speciale regex-tekens in titels → `safeTitleForGrep` column bevat al de escaped versie
- Twee tests met identieke titel in verschillende bestanden → voeg `targetPath` van het originele bestand toe als extra argument
- Alle tests gefaald → gebruik gewone rerun (niet rerunFailed)


---

## 12. Service Boundaries

### ProjectRegistryService

```typescript
type RegisteredProject = {
  id: string; name: string; rootPath: string
  source: 'created' | 'imported'
  createdAt: string; updatedAt: string; lastOpenedAt?: string
}
```

Methoden: `addProject`, `importProject`, `listProjects`, `openProject`, `removeProject`

**Conflict bij aanmaken:** Als gekozen map al `playwright.config.*` bevat → dialoog: "Map bevat al een Playwright-project. Importeren in plaats van aanmaken?"

---

### ProjectHealthService

**Cache-strategie:** Geldig voor 1 uur. Geïnvalideerd als:
- `package.json` of `playwright.config.*` wijzigt via FileWatchService
- Gebruiker klikt "Refresh"
- Project opnieuw geopend, cache ouder dan 1 uur

```typescript
type ProjectHealth = {
  status: 'healthy' | 'warning' | 'error'
  checks: {
    node: HealthItem          // node --version, minimum 18.x
    npm: HealthItem
    playwrightPackage: HealthItem
    playwrightVersion: HealthItem   // minimum 1.40.0
    playwrightConfig: HealthItem
    configReadable: HealthItem      // kon playwright.config.ts gelezen worden?
    testDir: HealthItem             // configSummary.testDir bestaat op schijf?
    browserInstall: HealthItem
  }
}

type HealthItem = {
  status: 'ok' | 'warning' | 'error'
  message?: string
  value?: string          // bijv. gedetecteerde versie of geresolvede testDir
  actionHint?: string     // bijv. "Run: npx playwright install"
}
```

**`testDir` check:** gebruikt `configSummary.testDir` — nooit hardcoded `tests/`.
Als config niet leesbaar: `configReadable` = warning, `testDir` = warning met tekst "Gebruikt fallback: tests/".

**UX:** Bij `error` → runs geblokkeerd. "Force run (ignore health)" escape zichtbaar maar onopvallend.

---

### ProjectTemplateService

Genereert nieuwe projectstructuur op schijf. Na aanmaken: `npm install` via `child_process.exec`.
Conflict-check: doelmap moet leeg zijn. Als niet leeg → gebruiker waarschuwen vóór aanmaken.

---

### FileWatchService

```typescript
type FileWatchEvent = {
  projectId: string
  kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  path: string
}
```

**Watch targets:** `configSummary.testDir`, `pages/`, `fixtures/`, `environments/`, project root
*(testDir wordt dynamisch gelezen via PlaywrightConfigService — zie sectie 8)*
**Ignored:** `node_modules/`, `test-results/`, `playwright-report/`, `.git/`, `.artifacts/`

**Speciale triggers:**
- Event in `environments/` → EnvironmentService cache wissen + push `ENVIRONMENTS_CHANGED`
- Als verwijderd bestand de actieve environment was → reset `activeEnvironment`, toon banner
- `playwright.config.*` wijzigt → health cache invalide + automatische nieuwe health check

---

### ProjectIndexService

**Cache-invalidatie v1:** Volledige rebuild bij elke watcher trigger. Bewust simpel.

```typescript
type ExplorerNode = FolderNode | FileNode | TestNode

type FolderNode  = { type: 'folder'; path: string; name: string; children: ExplorerNode[] }
type FileNode    = { type: 'file'; path: string; name: string; isTestFile: boolean;
                     parseState: 'ok' | 'warning' | 'error'; parseWarning?: string;
                     children?: TestNode[] }
type TestNode    = { type: 'test'; title: string; parentFile: string;
                     latestStatus?: 'passed' | 'failed' | 'skipped' }
```

**Testcase extractie v1 (regex):**
```typescript
const TEST_PATTERN = /^\s*test\s*\(\s*(['"`])(.*?)\1/gm
// Detecteert: test('title',  test("title",  test(`title`,
```

**Fallback:** Parse-fout → bestand blijft zichtbaar, children verborgen, `parseState = 'warning'`

---

### RunService

Eén actieve run tegelijk in v1.

```typescript
type BrowserSelection =
  | { mode: 'single'; projectName: string }  // één Playwright project (browser)
  | { mode: 'all' }                          // alle geconfigureerde --project waarden

type RunRequest = {
  projectId: string
  targetType: 'all' | 'folder' | 'file' | 'test'
  targetPath?: string
  testTitleFilter?: string
  browser: BrowserSelection
  environmentName?: string
  overrides?: {
    baseURL?: string
    env?: Record<string, string>
    headed?: boolean
    debug?: boolean
    retries?: number
  }
  streamLogs?: boolean
}
```

**`BrowserSelection` in de command builder:**
- `mode: 'single'` → `['--project=<projectName>']`
- `mode: 'all'` → geen `--project` flag — Playwright draait alle geconfigureerde projects

**`browser` kolom in `runs` tabel:** sla op als JSON-string:
- `'{"mode":"single","projectName":"chromium"}'`
- `'{"mode":"all"}'`

Run directory per run: `<rootPath>/.artifacts/runs/<run-id>/`
Inhoud: `log.txt`, `results.json`, `report/`, `traces/`, `screenshots/`, `videos/`

---

### EnvironmentService

```json
{
  "name": "staging",
  "baseURL": "https://staging.example.com",
  "variables": { "LOGIN_EMAIL": "test@example.com" },
  "secretRefs": { "LOGIN_PASSWORD": "pwstudio://project/<id>/staging/LOGIN_PASSWORD" }
}
```

**`resolveForRun` volgorde:**
1. Laad environment JSON
2. Los secretRefs op via SecretsService
3. Merge met overrides (overrides winnen altijd)
4. Geeft terug: `{ baseURL: string, env: Record<string, string> }`

---

### SecretsService

- Keychain service naam: `"pw-studio"`
- Account formaat: `"project/<projectId>/<envName>/<varName>"`
- Bij keychain niet beschikbaar: `SecretsUnavailableError` — nooit stille fallback naar plaintext

---

### RecorderService

Commando: `<lokale binary> codegen --output=<outputPath> <startUrl>`
Één sessie tegelijk. App-herstart beëindigt sessie (geen persistentie).
Na `recorder:save` → FileWatchService detecteert nieuwe file → Explorer refresht automatisch.

---

### ArtifactService

Na elke run: scan run directory, koppel artifacts aan `run_test_results`, sla `reportPath` op.

**"Open in editor"** in Explorer: `shell.openPath(filePath)` → OS-geregistreerde editor voor `.ts`.

---

## 13. Database Schema

### projects
```typescript
type ProjectRow = {
  id: string; name: string; rootPath: string
  source: 'created' | 'imported'
  createdAt: string; updatedAt: string; lastOpenedAt?: string
  defaultBrowser?: string; activeEnvironment?: string
}
```

### app_settings
```typescript
type AppSettingRow = { key: string; value: string } // value is JSON-encoded
// Voorbeelden: 'defaultWorkspacePath', 'theme'
```

### project_health_snapshots
```typescript
type ProjectHealthSnapshotRow = {
  projectId: string; checkedAt: string
  status: 'healthy' | 'warning' | 'error'; payloadJson: string
}
```

### runs
```typescript
type RunRow = {
  id: string; projectId: string
  parentRunId?: string
  status: 'queued' | 'running' | 'passed' | 'failed' | 'cancelled'
  startedAt: string; finishedAt?: string
  targetType: 'all' | 'folder' | 'file' | 'test'
  targetPath?: string; testTitleFilter?: string
  browserJson: string        // JSON: '{"mode":"single","projectName":"chromium"}' of '{"mode":"all"}'
  environmentName?: string; overridesJson?: string
  command: string
  logPath?: string; reportPath?: string; resultsPath?: string
}
```

### run_test_results
```typescript
type RunTestResultRow = {
  id: string; runId: string
  filePath: string; testTitle: string
  safeTitleForGrep: string      // regex-escaped versie van testTitle
  status: 'passed' | 'failed' | 'skipped' | 'timedOut'
  durationMs?: number; retryCount?: number; errorMessage?: string
  tracePath?: string; screenshotPath?: string; videoPath?: string
}
```

### file_artifact_policies
```typescript
type FileArtifactPolicyRow = {
  id: string; projectId: string
  filePath: string              // '*' = project default
  screenshotMode: 'off' | 'on-failure' | 'always'
  traceMode: 'off' | 'on-failure' | 'always'
  videoMode: 'off' | 'on-failure' | 'always'
  updatedAt: string
}
// Resolution: file override → project default (filePath = '*')
```

---

## 14. Projectstructuur op schijf

### App (de codebase zelf)
```
pw-studio/
├── src/
│   ├── main/
│   │   ├── ipc/
│   │   ├── services/          ← alle 10 services
│   │   ├── db/                ← migrations.ts, schema.ts
│   │   └── utils/             ← playwrightBinary.ts
│   ├── preload/
│   │   └── index.ts           ← contextBridge
│   ├── renderer/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── store/
│   └── shared/
│       ├── types/             ← ipc.ts, domain types
│       └── constants/
├── resources/
│   └── icon.ico
├── package.json
└── electron-builder.yml
```

### Per beheerd project
```
webshop-tests/
├── playwright.config.ts
├── package.json
├── tests/
├── pages/
├── fixtures/
├── environments/
│   └── local.json
├── .artifacts/
│   └── runs/<run-id>/
│       ├── log.txt
│       ├── results.json       ← JSON reporter output
│       ├── report/            ← HTML report
│       ├── traces/
│       ├── screenshots/
│       └── videos/
└── .pwstudio/
    ├── project.json
    └── presets.json
```

---

## 15. Schermen

| Scherm | Verantwoordelijkheid |
|---|---|
| Projects | Registry, create/import, recente projecten |
| Dashboard | Project summary, health panel, laatste runs, quick actions |
| Explorer | File tree, test nodes, artifact policy editing, run entrypoints |
| Recorder | Codegen starten, outputmap kiezen, opname opslaan |
| Runs | History list, actieve run state, filters |
| Run Detail | Logs, test results, artifacts, errors, metadata (tabs) |
| Settings | App defaults + "Database locatie" tonen, project defaults, browsers, environments |

**SQLite locatie tonen** in Settings → App: `app.getPath('userData')/pw-studio.db`
(voor troubleshooting en backup door de gebruiker)

**"Open in editor"** in Explorer context menu: `shell.openPath(filePath)`

---

## 16. Build Volgorde

### Phase 1 — Foundation
Electron shell, React renderer, SQLite + migrations systeem, preload/contextBridge volledig opgezet (zie sectie 4), IPC constanten in `shared/types/ipc.ts`, project registry, basic settings.
**Milestone:** App start. IPC-structuur ligt vast. Project aanmaken en registreren werkt.

### Phase 2 — Project Lifecycle + Health
Wizard (met conflict-check op bestaande map), template generation, project open flow, health checks met cache-strategie, Playwright versie detectie via lokale binary, Health Panel + Force Run escape.
**Milestone:** Project importeren, health checks zien.

### Phase 3 + 4 — Explorer + Run Engine (parallel starten)
**Phase 3:** chokidar (incl. environment + config cache-invalidatie), ProjectIndexService (volledige rebuild), file tree, test file detection, regex testcase extractie, parse warnings.
**Phase 4 (PoC parallel):** Lokale binary detectie, CLI command builder, single active run via spawn(), log streaming (zie protocol sectie 4), cancel flow (zie volgorde sectie 4), run history, run detail basics.
**Milestone:** Explorer live + één test file runnen, exit code en log zien.

### Phase 5 — Artifact Layer
ArtifactService, file_artifact_policies (migration 3), parentRunId + safeTitleForGrep (migration 3), artifact policy → CLI flags (zie sectie 9), rerunFailed (zie sectie 10), run detail artifacts tabblad.
**Milestone:** Artifacts instelbaar per bestand, rerun failed werkt.

### Phase 6 — Environments + Secrets + Recorder
EnvironmentService + watcher-invalidatie, SecretsService (keytar), tijdelijke run overrides, RecorderService (recorder output → watcher → explorer refresh automatisch).
**Milestone:** Environment met secret ophalen in run, recording opslaan.

### Phase 7 — Packaging + Polish
Windows .exe (electron-builder), pad-audit (geen hardcoded paden), IpcEnvelope.error uitgewerkt per service, SQLite locatie tonen in Settings, documentatie, sample project.
**Milestone:** PW Studio v1 installeerbaar als .exe.

---

## 17. Bewuste Technische Schuld v1

| Item | V1 beslissing | V2 aanpak |
|---|---|---|
| Index rebuild | Volledige rebuild per watcher trigger | Partial invalidation per pad |
| Testcase extractie | Regex-based | AST via TypeScript compiler API |
| Log opslag | `logPath` als bestandspad | `run_logs` tabel voor search/filter |
| Artifact policies | Project + file level | Per test level |
| Package managers | Alleen npm | pnpm en yarn |
| Platforms | Windows-only packaging | macOS + Linux |
| "Open in editor" | `shell.openPath()` (OS default) | Configureerbare editor + VS Code URI |
| rerunFailed bij identieke titels | Best effort via grep | Bestandspad als extra constraint |

---

## 18. AI-Future Voorbereiding

```typescript
// src/main/ai/providers/TestGenerationProvider.ts
export interface TestGenerationProvider {
  generateTest(prompt: string, context: ProjectContext): Promise<GeneratedTest>
}
// Providers later: OpenAI, Anthropic, lokaal model
// AI bovenop projectmodel — niet erin verweven
```

---

## 19. Definition of Done — v1

PW Studio v1 is klaar wanneer een gebruiker:

1. Een nieuw project kan aanmaken via wizard
2. Een bestaand Playwright-project kan importeren
3. Direct kan zien of het project gezond is
4. Tests kan zien in een live explorer (folders, files, testcases)
5. Een test/file/folder/all kan runnen met de lokale binary
6. Logs en testresultaten per run kan terugkijken
7. Artifacts per bestand kan instellen en direct openen
8. Environments met versleutelde secrets kan beheren
9. Tijdelijke run overrides kan meegeven
10. Codegen kan starten en opslaan
11. De app als Windows `.exe` kan installeren
12. De SQLite databaselocatie kan zien in Settings

---

## Eerste milestone

> *"Open imported Playwright project, pass health checks, show live explorer that refreshes on file changes — en draai één test file met de lokale Playwright binary, zie exit code en log."*

