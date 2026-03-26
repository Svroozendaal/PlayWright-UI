# PW Studio — Implementatieprompts v1
> Één prompt per fase. Zelfstandig bruikbaar in een nieuwe Claude Code sessie.
> Voeg `pw-studio-blueprint.md` altijd als context toe aan elke sessie.

---

## PROMPT 1 — Foundation

```
Je gaat PW Studio bouwen: een Electron desktop-app voor Playwright Test.
Dit is Phase 1: Foundation. De volledige architectuur staat in pw-studio-blueprint.md.

DOEL
Een werkende Electron + React app met SQLite, project registry, en een volledig
opgezet IPC-systeem dat als fundament dient voor alle volgende fases.

DELIVERABLES

1. Project scaffolding
   - Electron + React + TypeScript
   - electron-builder configuratie
   - TypeScript strict mode in main én renderer
   - Development workflow met hot reload (bijv. electron-vite)
   - Mapstructuur: src/main/, src/preload/, src/renderer/, src/shared/

2. Preload / contextBridge (KRITIEK — doe dit eerst goed)
   Implementeer het preload script exact zoals beschreven in de blueprint (sectie 4):
   - window.api.invoke(channel, payload) → ipcRenderer.invoke
   - window.api.on(channel, handler) → ipcRenderer.on
   - window.api.off(channel, handler) → ipcRenderer.removeListener
   Alle drie moeten aanwezig zijn. off() wordt gebruikt in useEffect cleanup.

3. IpcEnvelope type + IPC constanten
   In src/shared/types/ipc.ts:
   - type IpcEnvelope<T> = { version: 1; payload?: T; error?: { code: string; message: string } }
   - Alle IPC channels als const IPC = { ... } object (zie blueprint sectie 4)

4. SQLite bootstrap met migrations
   - better-sqlite3
   - Database locatie: app.getPath('userData') + '/pw-studio.db'
   - schema_version tabel + migration runner (zie blueprint sectie 5)
   - Migration 1: projects tabel + app_settings tabel

5. ProjectRegistryService
   - addProject / importProject / listProjects / openProject / removeProject
   - Registry = metadata + paden, geen bronbestanden
   - importProject controleert of rootPath bestaat en een directory is

6. IPC handlers voor projects
   Alle handlers in src/main/ipc/ als losse bestanden per domein.
   Gebruik altijd IpcEnvelope wrapper voor response (ook bij errors).
   Channels: projects:list, projects:create, projects:import, projects:get,
             projects:open, projects:remove

7. Basis React UI
   - Router (electron-compatible, bijv. hash router)
   - Projects scherm: lijst, "Nieuw project" knop, "Importeer project" knop
   - Directory picker via dialog.showOpenDialog (in main, via IPC)
   - Leeg project detail scherm (placeholder)

8. Basic settings
   - app_settings tabel (key-value, value JSON-encoded)
   - Sla 'defaultWorkspacePath' op (suggestie: app.getPath('documents'))

TECHNISCHE EISEN
- Geen hardcoded paden — altijd path.join() en app.getPath()
- IPC handlers alleen in main, renderer gebruikt alleen window.api
- TypeScript strict mode, geen any

SERVICE INITIALISATIE (verplicht patroon — zie blueprint sectie 4a)
Implementeer ServiceContainer en openDatabase() zoals beschreven in de blueprint.
Initialisatievolgorde in src/main/index.ts:
  1. openDatabase()           → maakt schema_version AAN + runMigrations()
  2. createWindow()           → BrowserWindow aanmaken
  3. createServices(db, win)  → alle services aanmaken met afhankelijkheden
  4. registerAllHandlers(services) → IPC handlers registreren

KRITIEK: openDatabase() moet schema_version aanmaken via db.exec() VOOR runMigrations().
Zie blueprint sectie 5 — de runner doet SELECT MAX(version), die tabel moet al bestaan.

EINDPUNT
App start. Project aanmaken (naam + map kiezen via directory picker) werkt.
Bestaande map importeren werkt. Projecten overleven herstart.
ServiceContainer en IPC-structuur liggen vast voor alle volgende fases.

VOLGORDE
1. Mapstructuur + package.json
2. src/shared/types/ipc.ts (IpcEnvelope + IPC constanten)
3. src/preload/index.ts (contextBridge)
4. src/main/db/ (openDatabase + runMigrations)
5. src/main/services/ServiceContainer.ts
6. src/main/services/ProjectRegistryService.ts
7. src/main/index.ts (app.whenReady + initialisatievolgorde)
8. src/main/ipc/projectHandlers.ts
9. src/renderer/ (UI)
```

---

## PROMPT 2 — Project Lifecycle + Health

```
Dit is Phase 2 van PW Studio: Project Lifecycle + Health.
Phase 1 is afgerond: Electron draait, registry werkt, SQLite + migrations opgezet,
preload/contextBridge volledig aanwezig, IPC constanten in shared/types/ipc.ts.

DOEL
Projecten aanmaken via wizard, project-gezondheid controleren, Playwright versie detecteren.

DELIVERABLES

1. Playwright binary helper (EERST bouwen, rest hangt hier van af)
   Implementeer src/main/utils/playwrightBinary.ts (zie blueprint sectie 7):
   - getPlaywrightBinary(rootPath): string
     → node_modules/.bin/playwright op macOS/Linux
     → node_modules/.bin/playwright.cmd op Windows
   - spawnPlaywright(args, rootPath, extraEnv?): ChildProcess
     → spawn met shell: false
   - getPlaywrightVersion(rootPath): string
     → execFileSync(['--version']), extract versienummer

2. ProjectTemplateService
   Wizard-parameters: projectName, rootPath, browsers[], includeExampleTests,
   includeAuth, includePageObjects, includeFixtures

   Gegenereerde structuur:
   - package.json met @playwright/test
   - playwright.config.ts geconfigureerd met gekozen browsers
   - tests/ (altijd), pages/ (als includePageObjects), fixtures/ (als includeFixtures)
   - environments/local.json template
   - .pwstudio/project.json met defaults (zie blueprint sectie 6)

   Conflict-check: als rootPath al playwright.config.* bevat → throw ConflictError
   met message "map bevat al een Playwright-project"
   Na generatie: npm install via child_process.exec in rootPath

3. ProjectHealthService
   Implementeer alle checks (zie blueprint sectie 11 — ProjectHealthService):
   - node: execFile('node', ['--version']), minimum 18.x
   - npm: execFile('npm', ['--version'])
   - playwrightPackage: controleer node_modules/@playwright/test/package.json
   - playwrightVersion: getPlaywrightVersion(), minimum 1.40.0
   - playwrightConfig: zoek playwright.config.ts of playwright.config.js
   - configReadable: readPlaywrightConfig() lukten zonder fallback? (zie blueprint sectie 8)
     → Als readMethod === 'fallback': status = 'warning', message = "Config kon niet worden gelezen"
   - testDir: fs.existsSync(configSummary.testDir)
     → Gebruik configSummary.testDir — NOOIT hardcoded 'tests/'
     → Als configReadable = fallback: check op testDir met waarschuwing
   - browserInstall: getPlaywrightBinary + ['install', '--dry-run'], exit code 0?

   PlaywrightConfigService:
   Bouw ook src/main/services/PlaywrightConfigService.ts (zie blueprint sectie 8).
   Health checks gebruiken configSummary.testDir, niet een hardcoded pad.
   Alle andere services die testDir nodig hebben vragen het op via PlaywrightConfigService.

   Cache-strategie:
   - Sla snapshot op in project_health_snapshots (migration 1 uitbreiden of migration 2)
   - Cache geldig voor 1 uur
   - Geïnvalideerd als FileWatchService playwright.config.* wijziging meldt
   - Geïnvalideerd als gebruiker "Refresh" klikt

   type HealthItem heeft actionHint veld: bijv. "Voer uit: npx playwright install"

4. Project open flow
   Bij openen project:
   1. Project laden uit registry
   2. rootPath bestaat? Zo niet → ProjectNotFoundError
   3. Health check (uit cache als < 1 uur oud)
   4. .pwstudio/project.json laden, aanmaken als ontbreekt
   5. lastOpenedAt updaten in SQLite

5. IPC handlers
   Channels: projects:create (wizard → aanmaken + registreren),
             health:get (cached ophalen), health:refresh (forceer nieuwe check)

   Bij wizard-conflict (bestaande playwright.config.*):
   Geef terug: { error: { code: 'PROJECT_EXISTS', message: '...' } }
   De UI vraagt dan: "Importeren in plaats van aanmaken?"

6. UI: Project aanmaken wizard (4 stappen)
   Stap 1: naam + rootpad (directory picker)
   Stap 2: browsers selecteren (checkboxes: chromium / firefox / webkit)
   Stap 3: opties (examples / auth / page objects / fixtures)
   Stap 4: overzicht + bevestigen
   Progress indicator tijdens aanmaken + npm install

7. UI: Health Panel (op project dashboard)
   - Per check: icoontje (✓ / ⚠ / ✗) + message + actionHint
   - Playwright versie tonen als value
   - "Refresh" knop → health:refresh
   - Bij status 'error': run-knoppen disabled
   - "Force run (ignore health)" link — klein, onopvallend, werkt wel

EINDPUNT
Nieuw project aanmaken via wizard werkt (incl. npm install).
Bestaand project importeren werkt.
Health checks zichtbaar na openen.
Run-knoppen disabled bij error-status.
Force run escape aanwezig.
```

---

## PROMPT 3 — Explorer Foundation

```
Dit is Phase 3 van PW Studio: Explorer Foundation.
START OOK PHASE 4 (Run Engine PoC) ZODRA ÉÉN BESTAND IN DE TREE STAAT.

Phase 1+2 zijn afgerond.

DOEL
Een live file explorer die automatisch refresht bij bestandswijzigingen.

DELIVERABLES

1. FileWatchService
   Gebruik chokidar.

   watchProject(projectId, rootPath): void
   unwatchProject(projectId): void

   Watch targets — gebruik getWatchTargets() uit blueprint sectie 12:
   - configSummary.testDir (dynamisch — NIET hardcoded 'tests/')
   - environments/ map (als die bestaat)
   - pages/ map (als die bestaat)
   - fixtures/ map (als die bestaat)
   - playwright.config.ts / playwright.config.js (als die bestaan)

   KRITIEK: Watch alleen paden die fs.existsSync() passeren.
   chokidar gooit een warning als je een niet-bestaand pad watcht.

   Ignored: node_modules/, test-results/, playwright-report/, .git/, .artifacts/

   configSummary ophalen:
   Roep PlaywrightConfigService.get(projectId, rootPath) aan bij watchProject().
   Sla de watch-targets op zodat je ze kunt opruimen bij unwatchProject().
   Als playwright.config.* wijzigt → invalideer PlaywrightConfigService cache
   → herbereken watch targets → herstart watcher voor dit project.

   Events debouncen: 300ms
   type FileWatchEvent = { projectId, kind, path }
   kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'

   Watcher doet GEEN parsing — meldt alleen events.

   Speciale triggers (belangrijk):
   - Event in environments/ map:
     → EnvironmentService.invalidateCache(projectId) aanroepen
     → webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId })
     → Als verwijderd bestand de activeEnvironment was:
       UPDATE projects SET activeEnvironment = NULL
       push banner-event naar renderer

   - Event op playwright.config.*:
     → ProjectHealthService.invalidateCache(projectId)
     → automatisch health:refresh starten

2. ProjectIndexService
   Bouwt in-memory explorer tree. Volledig los van de watcher.

   buildIndex(projectId, rootPath): Promise<ExplorerNode[]>
   invalidate(projectId): void
   getTree(projectId): ExplorerNode[] | null
   getParseWarnings(projectId): ParseWarning[]

   V1 strategie: volledige rebuild bij elke watcher trigger (bewust simpel).

   Layer 1 — File Tree: altijd beschikbaar, puur filesystem read
   Root van de tree = configSummary.testDir (van PlaywrightConfigService)
   NIET hardcoded 'tests/' — gebruik altijd de dynamische waarde.

   Layer 2 — Test file detection: *.spec.ts en *.test.ts
   Layer 3 — Testcase extractie (best effort, mag falen):
     Regex: /^\s*test\s*\(\s*(['"`])(.*?)\1/gm
     Detecteert: test('title',  test("title",  test(`title`,

   ExplorerNode types: zie blueprint sectie 11 (ProjectIndexService)

   Bij parse-fout:
   - Bestand blijft zichtbaar (parseState: 'warning')
   - Children worden niet getoond
   - parseWarning bevat de foutmelding
   - Geen crash, geen throw

3. Koppeling watcher → indexer → renderer
   Watcher event → invalidate(projectId) → buildIndex() → webContents.send(EXPLORER_REFRESH)
   Renderer luistert op IPC.EXPLORER_REFRESH → haalt nieuwe tree op via invoke(EXPLORER_GET_TREE)

4. IPC handlers
   explorer:getTree → ProjectIndexService.getTree()
   explorer:refresh → forceert invalidate + buildIndex
   explorer:getFilePolicy → FileArtifactPolicyService.get() (stub, Phase 5)
   explorer:setFilePolicy → stub, Phase 5

5. UI: Explorer scherm
   Layout: links tree panel (resizable), rechts detail pane

   Tree rendering:
   - Folders uitklapbaar/inklappabel
   - Test files herkenbaar (ander icoontje)
   - Parse warning icoontje op file node
   - Test nodes als children van file node

   Context menu per node:
   - Folder: "Run folder", "New test file", "New folder"
   - File: "Run file", "Debug file", "Open in editor" (shell.openPath), "Set artifact policy"
   - Test node: "Run test", "Debug test"
   (Run-acties zijn stubs in Phase 3, functioneel in Phase 4)

   Detail pane bij file-selectie:
   - Bestandsnaam + volledig pad
   - parseState met warning tekst indien van toepassing
   - Artifact policy badge placeholder

   Live refresh: bij IPC.EXPLORER_REFRESH event → tree opnieuw ophalen, geen full reload

EINDPUNT
Explorer toont live boomstructuur.
Test files herkenbaar, testcases zichtbaar als children.
Parse-fout in een bestand breekt de explorer niet.
Bij bestandswijziging in projectmap refresht de tree automatisch.
```

---

## PROMPT 4 — Run Engine

```
Dit is Phase 4 van PW Studio: Run Engine.
Start dit als PoC PARALLEL aan Phase 3 zodra de explorer één bestand toont.

Phase 1+2 afgerond. Phase 3 in progress.

DOEL
Playwright-tests aansturen via de lokale binary, logs streamen, resultaten opslaan.
VALIDEER VROEG: dit is de technisch meest onzekere fase.

PoC-validatiedoelen (doe dit als eerste):
- child_process.spawn() op Windows met lokale .cmd binary → werkt?
- stdout/stderr correct ontvangen, geen encoding-problemen?
- Exit code: 0 bij alles passed, 1 bij failures?
- JSON reporter results.json aangemaakt en parseerbaar?
- .artifacts/runs/ map correct aangemaakt?

DELIVERABLES

1. CLI Command Builder
   Bouwt de argument-array voor spawn (geen string, array van args):

   Input: RunRequest (zie blueprint sectie 11 — RunService)

   Altijd aanwezig: ['test', '--reporter=json', '--reporter=html']
   Browser (gebruik BrowserSelection type uit blueprint sectie 12 — RunService):
   - { mode: 'single', projectName: 'chromium' } → ['--project=chromium']
   - { mode: 'all' }                             → geen --project flag (Playwright draait alles)
   De lijst met beschikbare projectnamen komt uit PlaywrightConfigService.get().projects
   Target: bestandspad of map als extra arg
   Test filter: ['--grep=<testTitleFilter>']
   Headed: ['--headed']
   Debug: ['--debug']
   Output map: ['--output=<runDir>']
   Artifact flags: buildArtifactFlags(resolvedPolicy) (zie blueprint sectie 9)
   BaseURL override: via PLAYWRIGHT_BASE_URL env var (niet als CLI arg)

   Publieke methode buildCommand(request): string[] zodat de UI het kan tonen.

2. Run directory aanmaken
   <rootPath>/.artifacts/runs/<run-id>/
   Subdirs aanmaken: log.txt (leeg), traces/, screenshots/, videos/
   Playwright's --output flag wijst hier naartoe voor attachments.

3. RunService — run starten
   startRun(request: RunRequest): Promise<string>  // returns runId

   Stappen:
   1. Controleer: is er al een actieve run? → throw ActiveRunError
   2. run row aanmaken in SQLite (status: 'queued')
   3. Run directory aanmaken
   4. Environment resolven (stub in Phase 4, volledig in Phase 6)
   5. Command bouwen
   6. spawnPlaywright(args, rootPath, envVars) aanroepen
   7. status updaten naar 'running'
   8. stdout/stderr streamen (zie punt 4)

4. Log streaming
   Protocol: zie blueprint sectie 4 — Log streaming protocol.

   Per stdout/stderr regel:
   - Schrijf naar log.txt (fs.appendFileSync of write stream)
   - Als request.streamLogs: webContents.send(IPC.RUNS_LOG_EVENT, logEvent)
     type LogEvent = { runId, line, timestamp (ISO 8601), source: 'stdout'|'stderr' }

   Bij process 'close' event:
   1. Exit code opslaan
   2. Bepaal outcome via determineOutcome() (zie blueprint sectie 12 — RunService):
      - exitCode === 0                          → 'passed'
      - exitCode !== 0 + results.json parseerbaar → 'failed'  (tests gedraaid maar gefaald)
      - exitCode !== 0 + results.json ontbreekt  → 'config-error'  (Playwright startte niet)
   3. results.json parsen → run_test_results opslaan (alleen bij 'failed', niet bij 'config-error')
   4. reportPath bepalen en opslaan
   5. run.status updaten naar outcome
   6. run.finishedAt opslaan
   7. webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: outcome, finishedAt })

5. RunResultParser
   Implementeer parseJsonReport() uit blueprint sectie 8.
   Sla safeTitleForGrep op (regex-escaped testtitel) — nodig voor Phase 5 rerunFailed.
   results.json locatie: <runDir>/results.json
   (Playwright schrijft hier naartoe via --reporter=json met --output flag)

   BELANGRIJK: Playwright's JSON reporter schrijft naar stdout als geen output-path
   is opgegeven. Gebruik in de command builder:
   --reporter=json (output naar stdout) én --reporter=html (output naar report/)
   Vang stdout op en schrijf naar results.json zelf, OF gebruik
   --reporter=json:<runDir>/results.json syntaxis als die versie het ondersteunt.
   Test beide aanpakken tijdens de PoC.

6. Cancel flow
   cancelRun(runId): Promise<void>
   Volgorde (zie blueprint sectie 4 — Cancel flow):
   1. process.kill('SIGTERM')
   2. setTimeout 3000ms
   3. Als nog niet gesloten: process.kill('SIGKILL')
   4. status = 'cancelled' opslaan
   5. webContents.send(IPC.RUNS_STATUS_CHANGED, { runId, status: 'cancelled' })

7. Database: migrations voor runs
   Migration 2: runs tabel + run_test_results tabel (zie blueprint sectie 13)
   runs.status bevat: 'queued' | 'running' | 'passed' | 'failed' | 'config-error' | 'cancelled'
   parentRunId en safeTitleForGrep komen in migration 3 (Phase 5)

8. IPC handlers
   runs:start, runs:getActive, runs:list, runs:getById,
   runs:cancel, runs:rerun (volledige rerun met zelfde config)

   RUNS_LOG_EVENT en RUNS_STATUS_CHANGED zijn push-kanalen (geen handler nodig,
   main pusht via webContents.send)

9. UI: Runs scherm
   Lijst van runs (meest recent bovenaan)
   Kolommen: timestamp, target, browser, status badge, duur
   Filters: status (passed/failed/cancelled), datum
   Klik → Run Detail

10. UI: Run Detail scherm
    Tabs: Summary | Logs | Tests | Metadata

    Summary: status, command (toon buildCommand output), duur, test counts
    Logs: log.txt inhoud, scrollbaar, live-updates bij actieve run
          Renderer: on(RUNS_LOG_EVENT) bij mount, off() bij unmount
          Scroll-to-bottom bij nieuwe regels (tenzij gebruiker omhoog gescrolld heeft)
    Tests: run_test_results per test, status icoontje, foutmelding als aanwezig
    Metadata: runId, browser, environment, overrides

    Acties: Cancel (bij actieve run) | Rerun | Open HTML report (shell.openExternal)

    config-error state (apart van failed):
    - Summary tab: prominent "Playwright kon niet starten" bericht
    - Logs tab: automatisch geopend (meest nuttige info bij config-error)
    - Tests tab: toont "Geen testresultaten — zie logs"
    - Rerun knop aanwezig (gebruiker kan config fixen en dan herdraaien)

11. UI: Run entrypoints in Explorer
    Context menu acties (Run / Debug) nu functioneel maken.

    Run dialog (modal):
    - Browser dropdown:
      Opties ophalen via PlaywrightConfigService.get(projectId).projects
      Als projects leeg is (config-fallback): toon handmatig tekstveld i.p.v. dropdown
      Optie "Alle browsers" altijd aanwezig bovenaan → BrowserSelection { mode: 'all' }
    - Environment dropdown:
      Opties = listEnvironments(projectId) + "Geen environment"
      Standaard voorgeselecteerd: projects.activeEnvironment
      (Gap 11 fix: activeEnvironment moet ALTIJD als default verschijnen, niet leeg)
    - Headed toggle
    - "Advanced" toggle → toont baseURL override + extra env vars velden
    - Bevestigen → runs:start aanroepen
    - Terwijl run actief: run-knoppen disabled, "Cancel" knop zichtbaar

EINDPUNT
Test file, folder of all runnen via UI werkt.
Logs zichtbaar in Run Detail (live bij actieve run).
Test results per test zichtbaar (passed/failed/skipped).
Cancel en rerun werken.
Bij actieve run zijn andere start-knoppen disabled.
```

---

## PROMPT 5 — Artifact Layer

```
Dit is Phase 5 van PW Studio: Artifact Layer.
Phase 1-4 zijn afgerond.

DOEL
Artifacts koppelen aan runs. Per bestand instellen wat wordt vastgelegd.

DELIVERABLES

1. Database migration 3
   - file_artifact_policies tabel (zie blueprint sectie 12)
   - ALTER TABLE runs ADD COLUMN parentRunId TEXT
   - ALTER TABLE run_test_results ADD COLUMN safeTitleForGrep TEXT
   (Als safeTitleForGrep al in Phase 4 is toegevoegd, sla de kolom over)

2. ArtifactService
   BELANGRIJK: artifact-paden komen al uit de JSON reporter via RunResultParser.
   De parser slaat tracePath/screenshotPath/videoPath al op in run_test_results.
   Er is GEEN bestandsnaam-matching nodig — die paden zijn al bekend.

   collectArtifactsForRun(runId, runDir, exitCode): Promise<void>
   Doet alleen:
   - Controleer of report/index.html bestaat → UPDATE runs SET reportPath
   - Controleer of log.txt bestaat          → UPDATE runs SET logPath
   - Controleer of results.json bestaat     → UPDATE runs SET resultsPath
   - Roep determineOutcome(exitCode, resultsPath) aan → UPDATE runs SET status
   (artifact-paden per test zijn al ingevuld door RunResultParser in de close-handler)

   openArtifact(filePath): void → shell.openPath(filePath)
   openReport(runId): void → shell.openExternal('file://' + reportPath)

3. Artifact policy resolution
   resolvePolicy(projectId, filePath): ResolvedArtifactPolicy
   1. Zoek in file_artifact_policies WHERE projectId = ? AND filePath = ?
   2. Fallback: WHERE projectId = ? AND filePath = '*'
   3. Als geen project default bestaat: gebruik hardcoded fallback
      { screenshotMode: 'on-failure', traceMode: 'on-failure', videoMode: 'off' }

4. Command builder uitbreiden
   buildArtifactFlags(policy) integreren in de command builder (zie blueprint sectie 9):
   Exacte mapping:
   - 'off'        → screenshot=off,            video=off,            trace=off
   - 'on-failure' → screenshot=only-on-failure, video=retain-on-failure, trace=retain-on-failure
   - 'always'     → screenshot=on,             video=on,             trace=on

5. rerunFailed implementeren
   runs:rerunFailed handler:
   1. Haal failed results op: run_test_results WHERE runId = ? AND status IN ('failed','timedOut')
   2. Bouw grep-patroon: zie blueprint sectie 11
      grepPattern = failedResults.map(r => r.safeTitleForGrep).join('|')
   3. Browser: haal browserJson op uit de originele run → parse naar BrowserSelection
      Gebruik dezelfde BrowserSelection bij de herrun
   4. Edge case: identieke titels in meerdere bestanden → voeg targetPath toe als extra arg
   5. Edge case: alle tests gefaald → gebruik gewone rerun (runs:rerun)
   6. Edge case: run had status 'config-error' → rerunFailed niet aanbieden,
      alleen gewone rerun (er zijn geen test-resultaten om op te filteren)
   7. Start nieuwe run, sla parentRunId = originalRunId op

6. IPC handlers
   artifacts:listByRun, artifacts:open, artifacts:openReport
   explorer:getFilePolicy → laad policy uit SQLite
   explorer:setFilePolicy → sla op in SQLite, return updated policy

7. UI: Run Detail — Artifacts tabblad
   Per test in results:
   - Screenshot thumbnail als aanwezig (klikbaar → openArtifact)
   - "Open Trace" knop als trace aanwezig
   - "Open Video" knop als video aanwezig
   Bovenaan: "Open HTML Report" knop (altijd als report aanwezig)

8. UI: "Rerun failed" knop in Run Detail
   Zichtbaar als run status 'failed' is én er mislukte tests zijn.
   Niet zichtbaar als alle tests passed.

9. UI: Artifact Policy editor in Explorer detail pane
   Zichtbaar bij selectie van test file in explorer.
   Per type (Screenshot / Trace / Video): dropdown off / on-failure / always
   Label: "Project default" als geen file-specifieke override actief
   "Reset naar project default" knop
   Direct opslaan bij wijziging (geen aparte Save knop)
   Badge op file node in tree als custom policy actief is

10. UI: Project default policy in Settings → Project
    Stel screenshot/trace/video default in voor het hele project.

EINDPUNT
Artifacts instelbaar per bestand (en project-default).
Na run zijn screenshots/traces/video's direct klikbaar in Run Detail.
Rerun failed werkt en koppelt aan originele run via parentRunId.
HTML report opent in browser.
```

---

## PROMPT 6 — Environments + Secrets + Recorder

```
Dit is Phase 6 van PW Studio: Environments + Secrets + Recorder.
Phase 1-5 zijn afgerond.

DOEL
Environments en secrets veilig beheren. Recorder/codegen integreren.

DELIVERABLES

1. EnvironmentService
   Omgevingen als JSON-bestanden in <rootPath>/environments/*.json

   Formaat (zie blueprint sectie 11 — EnvironmentService):
   {
     "name": "staging",
     "baseURL": "https://staging.example.com",
     "variables": { "LOGIN_EMAIL": "test@example.com" },
     "secretRefs": { "LOGIN_PASSWORD": "pwstudio://project/<id>/staging/LOGIN_PASSWORD" }
   }

   listEnvironments(projectId): Environment[]
   saveEnvironment(projectId, env): void  → schrijf naar environments/<name>.json
   deleteEnvironment(projectId, name): void → verwijder JSON + alle secrets via SecretsService
   resolveForRun(projectId, envName, overrides?): ResolvedEnv

   resolveForRun stappen:
   1. Laad environment JSON
   2. Los alle secretRefs op via SecretsService.getSecret()
   3. Merge met overrides (overrides winnen altijd):
      - overrides.baseURL overschrijft env.baseURL
      - overrides.env mergt bovenop env.variables + resolved secrets
   4. Geeft terug: { baseURL: string, env: Record<string, string> }

   Integreer in RunService.startRun():
   Als request.environmentName aanwezig:
     resolvedEnv = await EnvironmentService.resolveForRun(...)
     geef door als extraEnv aan spawnPlaywright()

   BASE_URL mechanisme (zie blueprint sectie 12 — EnvironmentService):
   Injecteer baseURL als BASE_URL env var (NIET als PLAYWRIGHT_BASE_URL):
     extraEnv.BASE_URL = resolvedEnv.baseURL
   Dit werkt alleen als het gebruikersproject process.env.BASE_URL leest in playwright.config.ts.
   Bij wizard-gegenereerde projecten: altijd gegenereerd met process.env.BASE_URL.
   Bij geïmporteerde projecten: toon hint in Health Panel als baseURL hardcoded lijkt
     (detecteer: playwright.config.ts bevat geen 'process.env' → warning "baseURL env var niet gelezen").

   Cache-invalidatie: FileWatchService stuurt ENVIRONMENTS_CHANGED bij wijziging
   in environments/ → EnvironmentService.invalidateCache(projectId)

   Reconciliatie: Als projects.activeEnvironment niet bestaat als JSON →
   reset naar null, push banner-event naar renderer

2. SecretsService
   npm install keytar

   Keychain configuratie:
   - service: "pw-studio"
   - account formaat: "project/<projectId>/<envName>/<varName>"

   setSecret(projectId, envName, key, value): Promise<void>
   getSecret(projectId, envName, key): Promise<string | null>
   deleteSecret(projectId, envName, key): Promise<void>
   checkAvailability(): Promise<boolean>

   KRITIEK: Als keychain niet beschikbaar:
   - Throw SecretsUnavailableError met duidelijke message
   - Nooit stille fallback naar plaintext opslag
   - UI toont: "Keychain niet beschikbaar. [uitleg per OS]"

3. Run overrides volledig implementeren
   RunRequest.overrides was al aanwezig (Phase 4).
   Nu volledig integreren in startRun():
   - overrides.baseURL → BASE_URL env var (zie EnvironmentService sectie hierboven)
   - overrides.env → mergen in extraEnv
   - overrides.headed → --headed arg
   - overrides.debug → --debug arg
   - overrides.retries → --retries=N arg

4. IPC handlers
   environments:list, environments:create, environments:update, environments:delete
   secrets:set, secrets:getMasked (retourneert "••••••" niet de echte waarde), secrets:delete
   recorder:start, recorder:stop, recorder:save

5. UI: Environment manager (in Settings → Project tab)
   Lijst van environments
   Aanmaken / bewerken / verwijderen
   Per environment form:
   - naam + baseURL
   - Variables sectie: key-value editor (plaintext)
   - Secrets sectie: key-value editor (gemaskeerd, opslaan via secrets:set)
   - "Test connection" is out of scope voor v1
   Actieve environment instellen: dropdown in project dashboard
   - Huidige waarde = projects.activeEnvironment uit SQLite
   - Wijzigen → UPDATE projects SET activeEnvironment + direct effect op volgende run
   - "Geen environment" is altijd een geldige optie (= null)
   - Bij reconciliatie-fout (environment JSON verwijderd): dropdown toont "Niet gevonden — reset"

6. RecorderService
   Start Playwright codegen in extern browser venster (niet embedded in v1).

   type CodegenOptions = {
     startUrl?: string
     outputPath: string   // Volledig pad naar het doelbestand
     browser?: string
   }

   startCodegen(projectId, options): Promise<void>
   - Controleer: geen actieve run of codegen sessie
   - Commando: spawnPlaywright(['codegen', '--output=<outputPath>', '<startUrl>'], rootPath)
   - Sla huidige sessie op in memory
   - push RECORDER_STATUS: { status: 'running' }

   stopCodegen(): Promise<void>
   - Kill het codegen process
   - push RECORDER_STATUS: { status: 'idle' }

   saveOutput(targetPath): Promise<void>
   - Codegen schrijft al naar outputPath tijdens opname
   - Na stopCodegen: controleer of outputPath bestaat
   - FileWatchService pikt de nieuwe file automatisch op → Explorer refresht

   getStatus(): 'idle' | 'running'

   Beperking v1: één sessie tegelijk. App-herstart beëindigt sessie.
   Geen getStatus persistentie over herstarts.

7. UI: Recorder scherm
   Start URL invoerveld (optioneel)
   Outputmap kiezen: directory picker beperkt tot configSummary.testDir van het project
   (Haal testDir op via PlaywrightConfigService.get(projectId).testDir — NIET hardcoded 'tests/')
   Bestandsnaam invoerveld (default: "recorded-test.spec.ts")
   Browser dropdown
   "Start Recording" knop → recorder:start
   Status indicator: idle / recording (pulserende indicator)
   "Stop Recording" knop → recorder:stop
   Na stop: bestandspad tonen, "Open in Explorer" link

EINDPUNT
Environment aanmaken met plaintext variabelen + versleuteld secret.
Bij run wordt environment geladen, secrets uit keychain opgehaald.
Tijdelijke baseURL en env var overrides werken in run dialog.
Recorder starten → browser opent → recording stoppen → file verschijnt in explorer.
```

---

## PROMPT 7 — Packaging + Polish

```
Dit is Phase 7 van PW Studio: Packaging + Polish.
Phase 1-6 zijn afgerond. De app is functioneel compleet voor v1.

DOEL
Windows .exe bouwen, error states afronden, documentatie schrijven.

DELIVERABLES

1. electron-builder voor Windows
   electron-builder.yml:
   appId: com.pwstudio.app
   productName: PW Studio
   directories:
     output: dist
   win:
     target:
       - target: nsis
       - target: portable
     icon: resources/icon.ico
   nsis:
     oneClick: false
     allowToChangeInstallationDirectory: true

   package.json scripts:
   "build:win": "electron-builder --win"
   "build:win:portable": "electron-builder --win portable"

   Valideer na build:
   - App start correct na install
   - SQLite database aangemaakt in juiste AppData-map
   - Geen hardcoded paden in gecombineerde .exe

2. Pad-audit
   Doorzoek de hele codebase op:
   - Backslash literals in strings ('\\' of "\\")
   - Hardcoded 'C:\\' of '/home/' paden
   - Path concatenatie met + in plaats van path.join()

   Correcte alternatieven:
   - path.join() voor alle padconstructie
   - app.getPath('userData') voor app-data
   - app.getPath('documents') als default workspace suggestie
   - Alle paden testen met: spaties, andere schijfletter (D:\), speciale tekens

3. IpcEnvelope error codes uitwerken
   Definieer alle error codes als constanten:
   export const ERROR_CODES = {
     PROJECT_NOT_FOUND:        'PROJECT_NOT_FOUND',
     PROJECT_EXISTS:           'PROJECT_EXISTS',       // map heeft al playwright.config
     HEALTH_CHECK_FAILED:      'HEALTH_CHECK_FAILED',
     CONFIG_NOT_READABLE:      'CONFIG_NOT_READABLE',  // playwright.config kon niet worden gelezen
     ACTIVE_RUN_EXISTS:        'ACTIVE_RUN_EXISTS',
     RUN_NOT_FOUND:            'RUN_NOT_FOUND',
     SECRETS_UNAVAILABLE:      'SECRETS_UNAVAILABLE',
     ENVIRONMENT_NOT_FOUND:    'ENVIRONMENT_NOT_FOUND',
     RECORDER_ALREADY_RUNNING: 'RECORDER_ALREADY_RUNNING',
   } as const

   Per service: alle bekende fouten geven een IpcEnvelope met error.code terug.
   UI heeft per error.code een bruikbare melding.

4. UI foutschermen
   PROJECT_NOT_FOUND → "Project niet gevonden op schijf" + "Verwijder uit lijst" knop
   HEALTH_CHECK_FAILED (error status) → per check actiebare uitleg (actionHint gebruiken)
   CONFIG_NOT_READABLE → warning banner: "Playwright config kon niet worden gelezen.
     testDir valt terug op 'tests/'. Controleer playwright.config.ts op syntaxfouten."
     + toon readMethod in details voor debugging
   config-error run status → Run Detail opent automatisch op Logs tab,
     Summary toont "Playwright kon niet starten" (niet "X tests gefaald")
   BASE_URL hint → als playwright.config.ts geen process.env bevat:
     Health Panel warning: "baseURL lijkt hardcoded — PW Studio kan dit niet overschrijven.
     Voeg process.env.BASE_URL toe aan playwright.config.ts om environments te gebruiken."
   ACTIVE_RUN_EXISTS → "Er is al een actieve run. Wacht tot deze klaar is."
   SECRETS_UNAVAILABLE → "Keychain niet beschikbaar. [Windows: Credential Manager uitleg]"
   ENVIRONMENT_NOT_FOUND → banner "Actieve environment niet gevonden, gereset naar geen"
   Bestand verwijderd terwijl app open → explorer toont bestand als 'error' state

5. SQLite locatie tonen
   In Settings → App sectie:
   "Database locatie: [pad]" met kopieer-knop
   Dit is app.getPath('userData') + '/pw-studio.db'
   Gebruiker kan dit gebruiken voor backup of troubleshooting.

6. Documentatie
   README.md:
   - Wat is PW Studio (2 zinnen)
   - Vereisten: Node >= 18, npm, Playwright >= 1.40
   - Installatie (Windows installer)
   - Eerste stappen: project aanmaken of importeren
   - Screenshots van de 3 hoofdschermen

   CONTRIBUTING.md:
   - Development setup (npm install, npm run dev)
   - Build instructies
   - Mapstructuur uitleg (verwijst naar blueprint)
   - Hoe een nieuwe service toevoegen
   - Hoe een IPC-kanaal toevoegen

   ARCHITECTURE.md:
   - Korte samenvatting van de 4 architectuurlagen
   - Verwijs naar pw-studio-blueprint.md voor de volledige spec

7. Sample project
   Een klein werkend Playwright-project om mee te leveren:
   - 3 simpele tests die Playwright's eigen demo-app testen (playwright.dev/docs)
   - tests/smoke/ met 1 test, tests/checkout/ met 2 tests
   - environments/local.json met baseURL ingevuld
   - .pwstudio/project.json aanwezig
   - README: "Open dit als eerste project in PW Studio via 'Importeer project'"

8. AI interface voorbereiden (niet implementeren)
   Maak het bestand aan maar implementeer niets:
   // src/main/ai/providers/TestGenerationProvider.ts
   export interface TestGenerationProvider {
     generateTest(prompt: string, context: ProjectContext): Promise<GeneratedTest>
   }
   export type ProjectContext = { rootPath: string; testFiles: string[]; framework: 'playwright' }
   export type GeneratedTest  = { code: string; suggestedPath: string }

EINDPUNT
Windows installer en portable .exe beschikbaar.
App installeert clean, data in AppData.
Alle bekende error codes hebben een bruikbare UI-melding.
SQLite locatie zichtbaar in Settings.
README geeft nieuwe gebruikers een vliegende start.
Sample project werkt out-of-the-box.

---

PW STUDIO V1 IS KLAAR.

Definition of Done check:
✓ Nieuw project aanmaken via wizard (playwright.config.ts gegenereerd met process.env.BASE_URL)
✓ Bestaand project importeren
✓ Project health zien (met Force Run escape + configReadable check + testDir dynamisch)
✓ Explorer met live refresh + parse-fout graceful handling
✓ Watch targets alleen op bestaande mappen
✓ Tests runnen via lokale binary (file/folder/all browsers via BrowserSelection)
✓ Run dialog: activeEnvironment voorgeselecteerd, browser dropdown uit configSummary.projects
✓ config-error onderscheiden van failed — Logs tab automatisch geopend
✓ Logs en testresultaten terugkijken
✓ Artifacts per bestand instellen (correcte CLI flag mapping, paden uit JSON reporter)
✓ rerunFailed met grep-strategie en parentRunId (niet aanbieden bij config-error)
✓ Environments + secrets (keytar, geen plaintext fallback)
✓ BASE_URL als env var geïnjecteerd (niet PLAYWRIGHT_BASE_URL)
✓ Tijdelijke run overrides
✓ Codegen starten en opslaan → explorer refresht automatisch
✓ Windows .exe installeerbaar
✓ SQLite locatie zichtbaar in Settings
```

---

## Notities voor gebruik

**Volgorde:** Prompts 1–7 zijn sequentieel.
Uitzondering: start Phase 4 parallel aan Phase 3 zodra de explorer één bestand toont.

**Context per sessie:** Voeg altijd `pw-studio-blueprint.md` toe. Voor latere fases ook de bestaande codebase.

**Playwright JSON reporter locatie:**
Tijdens Phase 4: test of `--reporter=json` naar stdout schrijft of naar een bestand.
Als naar stdout: vang op in RunService en schrijf zelf naar `<runDir>/results.json`.
Als de versie `--reporter=json:<pad>` ondersteunt: gebruik dat.
Documenteer de gekozen aanpak in ARCHITECTURE.md.

**Windows spawn gedrag:**
Als `.cmd` binary niet werkt met `shell: false`, probeer `shell: true`.
Documenteer wat werkte in ARCHITECTURE.md zodat dit niet opnieuw uitgezocht hoeft te worden.
