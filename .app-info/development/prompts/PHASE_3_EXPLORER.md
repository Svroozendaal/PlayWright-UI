# PHASE 3 — Explorer Foundation

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Developer** — FileWatchService, ProjectIndexService, IPC handlers.
- **Designer** — Explorer tree UI, context menus, detail pane.
- **Tester** — validate live refresh, parse error handling, watcher triggers.

Sequence: Developer → Designer → Tester. **Start Phase 4 in parallel once one file appears in tree.**

## Prerequisites

Phase 1+2 are complete. **START PHASE 4 (Run Engine PoC) AS SOON AS ONE FILE APPEARS IN THE TREE.**

## Required Skills

Before starting, load and follow:

- `.app-info/skills/chokidar-watcher/SKILL.md` — file watching patterns, debouncing, ignored paths.
- `.app-info/skills/playwright-config-reader/SKILL.md` — dynamic testDir reading.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC push events from main to renderer.
- `.app-info/skills/react-tree-component/SKILL.md` — tree rendering, context menus, virtual scrolling.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.

## Goal

A live file explorer that automatically refreshes on file changes.

## Deliverables

### 1. FileWatchService
Uses chokidar.

```
watchProject(projectId, rootPath): void
unwatchProject(projectId): void
```

**Watch targets** — use `getWatchTargets()` from blueprint section 12:
- `configSummary.testDir` (dynamic — NOT hardcoded `tests/`)
- `environments/` folder (if it exists)
- `pages/` folder (if it exists)
- `fixtures/` folder (if it exists)
- `playwright.config.ts` / `playwright.config.js` (if they exist)

**CRITICAL:** Only watch paths that pass `fs.existsSync()`. chokidar throws a warning if you watch a non-existent path.

**Ignored:** `node_modules/`, `test-results/`, `playwright-report/`, `.git/`, `.artifacts/`

**configSummary retrieval:**
Call `PlaywrightConfigService.get(projectId, rootPath)` at `watchProject()`.
Store watch targets so they can be cleaned up at `unwatchProject()`.
If `playwright.config.*` changes → invalidate PlaywrightConfigService cache → recalculate watch targets → restart watcher for this project.

Events debounced: 300ms.
```typescript
type FileWatchEvent = { projectId: string; kind: string; path: string }
// kind: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
```

Watcher does NO parsing — only reports events.

**Special triggers (important):**
- Event in `environments/` folder:
  → Call `EnvironmentService.invalidateCache(projectId)`
  → `webContents.send(IPC.ENVIRONMENTS_CHANGED, { projectId })`
  → If deleted file was the activeEnvironment: `UPDATE projects SET activeEnvironment = NULL`, push banner event to renderer.

- Event on `playwright.config.*`:
  → `ProjectHealthService.invalidateCache(projectId)`
  → Automatically start `health:refresh`.

### 2. ProjectIndexService
Builds in-memory explorer tree. Completely separate from the watcher.

```
buildIndex(projectId, rootPath): Promise<ExplorerNode[]>
invalidate(projectId): void
getTree(projectId): ExplorerNode[] | null
getParseWarnings(projectId): ParseWarning[]
```

V1 strategy: full rebuild on every watcher trigger (intentionally simple).

- **Layer 1 — File Tree:** always available, pure filesystem read. Root of tree = `configSummary.testDir` (from PlaywrightConfigService). NOT hardcoded `tests/`.
- **Layer 2 — Test file detection:** `*.spec.ts` and `*.test.ts`
- **Layer 3 — Testcase extraction (best effort, may fail):**
  Regex: `/^\s*test\s*\(\s*(['"\`])(.*?)\1/gm`
  Detects: `test('title',` `test("title",` `` test(`title`, ``

ExplorerNode types: see blueprint section 12 (ProjectIndexService).

On parse error:
- File remains visible (`parseState: 'warning'`)
- Children are not shown
- `parseWarning` contains the error message
- No crash, no throw

### 3. Watcher → Indexer → Renderer Coupling
Watcher event → `invalidate(projectId)` → `buildIndex()` → `webContents.send(EXPLORER_REFRESH)`
Renderer listens on `IPC.EXPLORER_REFRESH` → fetches new tree via `invoke(EXPLORER_GET_TREE)`

### 4. IPC Handlers
- `explorer:getTree` → `ProjectIndexService.getTree()`
- `explorer:refresh` → forces invalidate + buildIndex
- `explorer:getFilePolicy` → `FileArtifactPolicyService.get()` (stub, Phase 5)
- `explorer:setFilePolicy` → stub, Phase 5

### 5. UI: Explorer Screen
Layout: left tree panel (resizable), right detail pane.

**Tree rendering:**
- Folders expandable/collapsible
- Test files recognisable (different icon)
- Parse warning icon on file node
- Test nodes as children of file node

**Context menu per node:**
- Folder: "Run folder", "New test file", "New folder"
- File: "Run file", "Debug file", "Open in editor" (`shell.openPath`), "Set artifact policy"
- Test node: "Run test", "Debug test"
  (Run actions are stubs in Phase 3, functional in Phase 4)

**Detail pane on file selection:**
- Filename + full path
- parseState with warning text if applicable
- Artifact policy badge placeholder

**Live refresh:** on `IPC.EXPLORER_REFRESH` event → re-fetch tree, no full reload.

## Exit Criteria

- Explorer shows live tree structure.
- Test files recognisable, testcases visible as children.
- Parse error in a file does not break the explorer.
- On file change in project folder, the tree refreshes automatically.
