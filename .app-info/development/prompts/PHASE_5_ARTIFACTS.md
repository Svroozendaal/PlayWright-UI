# PHASE 5 — Artifact Layer

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Developer** — ArtifactService, policy resolution, rerunFailed, migration 3.
- **Designer** — Artifacts tab, policy editor, rerun failed button.
- **Tester** — validate artifact policies, rerunFailed edge cases.

Sequence: Developer → Designer → Tester.

## Prerequisites

Phase 1–4 are complete.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/playwright-json-reporter/SKILL.md` — JSON report structure, attachment paths.
- `.app-info/skills/sqlite-migrations/SKILL.md` — migration 3 for artifact policies.
- `.app-info/skills/electron-ipc/SKILL.md` — IPC envelope pattern.
- `.app-info/skills/artifact-policy-resolution/SKILL.md` — file-level vs project-level policy merge, CLI flag mapping.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.

## Goal

Link artifacts to runs. Configure per file what gets captured.

## Deliverables

### 1. Database Migration 3
- `file_artifact_policies` table (see blueprint section 13)
- `ALTER TABLE runs ADD COLUMN parentRunId TEXT`
- `ALTER TABLE run_test_results ADD COLUMN safeTitleForGrep TEXT`
  (If `safeTitleForGrep` was already added in Phase 4, skip the column)

### 2. ArtifactService
**IMPORTANT:** artifact paths already come from the JSON reporter via RunResultParser.
The parser already stores `tracePath`/`screenshotPath`/`videoPath` in `run_test_results`.
There is NO filename matching needed — those paths are already known.

```
collectArtifactsForRun(runId, runDir, exitCode): Promise<void>
```
Only does:
- Check if `report/index.html` exists → `UPDATE runs SET reportPath`
- Check if `log.txt` exists → `UPDATE runs SET logPath`
- Check if `results.json` exists → `UPDATE runs SET resultsPath`
- Call `determineOutcome(exitCode, resultsPath)` → `UPDATE runs SET status`
  (per-test artifact paths are already filled in by RunResultParser in the close handler)

```
openArtifact(filePath): void → shell.openPath(filePath)
openReport(runId): void → shell.openExternal('file://' + reportPath)
```

### 3. Artifact Policy Resolution
```
resolvePolicy(projectId, filePath): ResolvedArtifactPolicy
```
1. Look in `file_artifact_policies WHERE projectId = ? AND filePath = ?`
2. Fallback: `WHERE projectId = ? AND filePath = '*'`
3. If no project default exists: use hardcoded fallback
   `{ screenshotMode: 'on-failure', traceMode: 'on-failure', videoMode: 'off' }`

### 4. Command Builder Extension
Integrate `buildArtifactFlags(policy)` into the command builder (see blueprint section 10):

Exact mapping:
| App mode | `--screenshot=` | `--video=` | `--trace=` |
|---|---|---|---|
| `'off'` | `off` | `off` | `off` |
| `'on-failure'` | `only-on-failure` | `retain-on-failure` | `retain-on-failure` |
| `'always'` | `on` | `on` | `on` |

### 5. rerunFailed Implementation
`runs:rerunFailed` handler:
1. Fetch failed results: `run_test_results WHERE runId = ? AND status IN ('failed', 'timedOut')`
2. Build grep pattern: see blueprint section 11.
   `grepPattern = failedResults.map(r => r.safeTitleForGrep).join('|')`
3. Browser: fetch `browserJson` from original run → parse to `BrowserSelection`. Use same `BrowserSelection` for rerun.
4. Edge case: identical titles in multiple files → add `targetPath` as extra arg
5. Edge case: all tests failed → use normal rerun (`runs:rerun`)
6. Edge case: run had status `'config-error'` → do not offer rerunFailed, only normal rerun (there are no test results to filter on)
7. Start new run, store `parentRunId = originalRunId`

### 6. IPC Handlers
- `artifacts:listByRun`, `artifacts:open`, `artifacts:openReport`
- `explorer:getFilePolicy` → load policy from SQLite
- `explorer:setFilePolicy` → store in SQLite, return updated policy

### 7. UI: Run Detail — Artifacts Tab
Per test in results:
- Screenshot thumbnail if present (clickable → openArtifact)
- "Open Trace" button if trace present
- "Open Video" button if video present

Top: "Open HTML Report" button (always if report present).

### 8. UI: "Rerun Failed" Button in Run Detail
Visible when run status is `'failed'` AND there are failed tests.
Not visible when all tests passed.

### 9. UI: Artifact Policy Editor in Explorer Detail Pane
Visible when selecting a test file in explorer.
Per type (Screenshot / Trace / Video): dropdown off / on-failure / always.
Label: "Project default" when no file-specific override is active.
"Reset to project default" button.
Direct save on change (no separate Save button).
Badge on file node in tree when custom policy is active.

### 10. UI: Project Default Policy in Settings → Project
Set screenshot/trace/video defaults for the entire project.

## Exit Criteria

- Artifacts configurable per file (and project default).
- After a run, screenshots/traces/videos are directly clickable in Run Detail.
- Rerun failed works and links to original run via `parentRunId`.
- HTML report opens in browser.
