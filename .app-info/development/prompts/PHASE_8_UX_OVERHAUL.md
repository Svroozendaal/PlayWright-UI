# PHASE 8 — Dashboard, Editor + UX Overhaul

## First Step

1. Read `.agents/AGENTS.md`.
2. Read `.agents/FRAMEWORK.md`.
3. Read `.app-info/ROUTING.md`.
4. Read `.app-info/docs/PW_STUDIO_BLUEPRINT.md` — the full architecture reference.

## Agent Routing

Per AGENTS.md routing rules:
- **Architect** — layout system redesign, navigation model, new IPC channels for file read/write.
- **Developer** — file read/write service, IPC handlers, search service, dashboard data aggregation.
- **Designer** — sidebar navigation, dashboard page, code viewer/editor, explorer overhaul, run shortcuts.
- **Tester** — validate all navigation flows, editor save/load, dashboard data accuracy, keyboard shortcuts.

Sequence: Architect → Developer → Designer → Tester.

## Prerequisites

Phase 1–7 are complete. The app is functionally complete but has significant UX gaps: the project homepage is a health panel (useless when all checks pass), navigation is a row of cramped header buttons, test files cannot be viewed or edited, and running tests requires too many clicks.

## Required Skills

Before starting, load and follow:

- `.app-info/skills/electron-ipc/SKILL.md` — IPC envelope pattern for new file read/write channels.
- `.app-info/skills/electron-react-scaffold/SKILL.md` — component structure and layout conventions.
- `.app-info/skills/path-safety/SKILL.md` — safe file read/write with path validation.
- `.app-info/skills/chokidar-watcher/SKILL.md` — file change detection for editor dirty state.
- `.agents/skills/code-quality/SKILL.md` — shared code quality checklist.

## Goal

Transform PW Studio from a functional tool into a polished, intuitive desktop app. Replace the health-panel homepage with a useful dashboard, add persistent sidebar navigation, enable viewing and editing test files inline, and reduce the number of clicks required to run a test from 4+ to 1.

---

## Deliverables

### 1. Layout System — Persistent Sidebar Navigation

**Problem:** Navigation is a row of 6 small white buttons crammed into the top-right corner of the header. Every sub-page has its own "Back" button. There is no persistent navigation — leaving a page loses all visual context of where you are.

**Solution:** Replace the header button row with a persistent left sidebar that stays visible on all project pages.

**Sidebar structure:**

```
┌──────────┬────────────────────────────────────┐
│ PW Studio│  [Page Header / Breadcrumb]        │
│          │                                     │
│ ● Dash   │  [Page Content]                    │
│   Explorer│                                    │
│   Runs   │                                    │
│   Recorder│                                   │
│   Envs   │                                    │
│   Flaky  │                                    │
│          │                                    │
│ ──────── │                                    │
│   Settings│                                   │
│   ← Back │                                    │
└──────────┴────────────────────────────────────┘
```

**Sidebar requirements:**
- Fixed width (220px), does not scroll with page content.
- Project name displayed at the top with a small health status indicator (green dot = all pass, amber dot = warnings, red dot = errors). Clicking the health dot opens a popover/tooltip with the health summary — NOT a full page.
- Navigation items: **Dashboard** (home icon), **Explorer** (folder icon), **Runs** (play icon), **Recorder** (circle/record icon), **Environments** (globe icon), **Flaky Tests** (warning icon).
- Divider line, then **Settings** (cog icon) at the bottom.
- **"Back to Projects"** link at the very bottom of the sidebar.
- Active page highlighted with a left border accent + background tint.
- Each nav item has an icon (SVG or Unicode symbol) + label text.
- When a run is active: the **Runs** nav item shows a small animated indicator (pulsing dot or spinner).

**Implementation:**
- Create a `ProjectLayout` wrapper component that renders the sidebar + a content area.
- All `/project/:id/*` routes render inside `ProjectLayout`.
- `ProjectLayout` fetches the project once and passes it down via React context or props.
- Remove all per-page "Back" buttons and header nav button rows.
- The `app-header` bar is kept only for the root `ProjectsPage` (no sidebar there).
- Each page inside the layout only renders its own content — no header, no back button.
- Page title shown as a breadcrumb or heading inside the content area.

**CRITICAL:** The sidebar must NOT re-render or lose state when navigating between pages. Use `<Outlet>` from react-router-dom with a layout route.

### 2. Project Dashboard — Replace Health Panel Homepage

**Problem:** When you open a project, you see a health check panel. Once everything is green, this page is dead weight — it shows nothing useful and you always have to navigate away.

**Solution:** Replace the `ProjectDetailPage` with a rich dashboard that gives an at-a-glance overview of the project and provides quick actions.

**Dashboard sections:**

#### 2a. Quick Actions Bar (top)
A horizontal row of large, prominent action cards:
- **Run All Tests** — single click starts a run with default settings (default browser, active environment, headed=false). No dialog. Uses `IPC.RUNS_START` with project defaults.
- **Record Test** — navigates to `/project/:id/recorder`.
- **Open Explorer** — navigates to `/project/:id/explorer`.

Each card: icon + label + optional subtitle (e.g. "Run All Tests" / "chromium · staging"). Cards are ~150px wide, with a subtle background colour and hover lift effect.

#### 2b. Recent Runs (middle-left)
A compact list of the 5 most recent runs:
- Each row: status dot (colour-coded), target name (or "All tests"), duration, relative time ("2m ago", "yesterday").
- Click any row → navigates to `/project/:id/runs/:runId`.
- "View all runs →" link at the bottom → `/project/:id/runs`.
- If no runs yet: empty state with "Run your first test" prompt + button.

#### 2c. Test Summary Stats (middle-right)
A set of stat cards:
- **Total test files** — count from explorer tree.
- **Total test cases** — count from explorer tree.
- **Pass rate** — percentage from last N runs (or last run).
- **Flaky tests** — count with link to flaky page.

Each stat: large number, small label underneath. Colour-coded (green for high pass rate, red for low, amber for flaky).

#### 2d. Health Status (compact, bottom or inline)
- When ALL checks pass: a single-line green banner: "All health checks passed" with a small "Details" link that expands inline or navigates to a modal.
- When there are warnings/errors: a compact card listing only the failing checks with their `actionHint`. Not the full HealthPanel — just the issues.
- **CRITICAL:** Health checks should NOT dominate the page. They are secondary information when everything is green.

**New IPC channel:**
- `IPC.DASHBOARD_GET_STATS` → `'dashboard:getStats'` — returns `{ totalFiles, totalTests, passRate, flakyCount, recentRuns[] }`. Aggregated in a new `DashboardService` or as a convenience method on existing services.

### 3. Code Viewer + Editor in Explorer

**Problem:** The Explorer shows a tree of test files but you cannot see what's inside them. Selecting a file shows only its path, type, and artifact policy. There is no way to view or edit test code without opening an external editor.

**Solution:** Replace the Explorer detail pane with a full code viewer/editor.

#### 3a. File Content Reading (Backend)
New IPC channels:
- `IPC.FILE_READ` → `'file:read'` — reads a file and returns its content as a string. Validates the path is within the project `rootPath` (security: prevent path traversal). Returns `{ content: string, encoding: 'utf-8' }`.
- `IPC.FILE_WRITE` → `'file:write'` — writes content to a file. Same path validation. Returns `{ success: true }` or error envelope.
- `IPC.FILE_CREATE` → `'file:create'` — creates a new file with optional template content. Validates path is within `configSummary.testDir`.

New service: `FileService` in `src/main/services/FileService.ts`:
```typescript
readFile(rootPath: string, filePath: string): string
writeFile(rootPath: string, filePath: string, content: string): void
createFile(rootPath: string, filePath: string, content: string): void
```

**CRITICAL:** All file operations must validate that the target path is within the project `rootPath`. Use `path.resolve()` and check that the resolved path starts with the resolved `rootPath`. This prevents directory traversal attacks.

#### 3b. Code Viewer (Renderer)
When a test file or file node is selected in the Explorer tree, the detail pane shows:
- **File header:** filename, full path, file size, last modified date.
- **Code area:** syntax-highlighted, read-only by default, with line numbers.
- **Edit button:** toggles the code area into edit mode.

**Syntax highlighting:** Use a lightweight approach — either:
- A `<pre><code>` block with a CSS-based highlighter (e.g., Prism.js or highlight.js — small bundle).
- OR a `<textarea>` with monospace font for the editor mode (simpler, no extra dependency).

Recommended: Use a `<textarea>` with monospace font for editing (keeps bundle small), and a `<pre>` with basic keyword highlighting for view mode. TypeScript keyword highlighting: `import`, `export`, `const`, `let`, `async`, `await`, `function`, `test`, `describe`, `expect`, strings, comments.

**Editor controls** (visible in edit mode):
- **Save** button (+ Ctrl+S keyboard shortcut) → calls `IPC.FILE_WRITE`.
- **Discard** button → reverts to last saved content.
- **Dirty indicator** — dot or asterisk next to filename when unsaved changes exist.

**Tab bar** (above code area):
- **Code** tab — the code viewer/editor (default).
- **Info** tab — file metadata + artifact policy editor (what the detail pane currently shows).
- This replaces the current flat detail pane.

#### 3c. New Test File Creation
The "New test file" context menu item (currently a disabled stub) becomes functional:
- Right-click folder → "New test file" → inline rename field appears in the tree (like VS Code).
- User types filename (auto-appends `.spec.ts` if not present).
- File created with template content:

```typescript
import { test, expect } from '@playwright/test'

test('', async ({ page }) => {
  //
})
```

- After creation: file is auto-selected in tree and opens in editor mode for immediate editing.

The "New folder" context menu item also becomes functional:
- Creates the directory.
- Inline rename field for folder name.

#### 3d. Post-Recording Edit Flow
After the Recorder finishes and shows the success banner:
- Add a **"Open in Editor"** button next to the file path.
- Clicking it navigates to `/project/:id/explorer`, auto-selects the recorded file in the tree, and opens it in edit mode.
- This connects the recording flow to the editing flow — record → review → edit → run.

### 4. Quick Run — Reduce Clicks to Run a Test

**Problem:** Running a single test requires: navigate to Explorer → find test in tree → right-click → "Run test" → configure RunDialog → click Run. That is 5+ interactions. Power users want 1 click.

**Solution:** Multiple run shortcuts at different levels.

#### 4a. Inline Run Buttons on Tree Nodes
When hovering over a tree node in the Explorer, show a small play button (▶) on the right side of the row:
- Click the play button → immediately starts a run with default settings (default browser, active environment, no dialog).
- The existing right-click → RunDialog flow remains available for custom configuration.
- Play button visible on: directories, test files, test cases.
- Visual: small, semi-transparent, becomes fully opaque on row hover.

#### 4b. Run Button in Code Viewer
When viewing a test file in the code editor:
- Show a **"Run File"** button in the file header bar.
- If the cursor/selection is inside a specific `test()` block: show **"Run Test: '<test title>'"** as well.
- These use default settings (no dialog).

#### 4c. Run from Dashboard
The "Run All Tests" quick action card on the dashboard (deliverable 2a) provides a single-click run.

#### 4d. Last Run Config Memory
Store the last used RunDialog configuration per project in memory (not persisted to DB — session only):
- When opening RunDialog, pre-fill with last used settings.
- Add a **"Run with last config"** button that skips the dialog entirely and reruns with the same settings.

#### 4e. Keyboard Shortcuts
- **F5** — Run current file (if in Explorer with a file selected) or Run All (if on Dashboard).
- **Ctrl+Shift+F5** — Run with dialog (opens RunDialog for current selection).
- **Escape** — Close any open dialog/modal.

Register shortcuts via `useEffect` + `window.addEventListener('keydown')` at the layout level.

### 5. Explorer Tree Overhaul

**Problem:** Tree nodes use single-letter icons ('D' for directory, 'T' for test file, 't' for test case, 'f' for file). Expand/collapse uses 'v' and '>'. This is cryptic and ugly. There is no search, no last-run status on nodes, and disabled stub buttons in the context menu.

#### 5a. Better Icons
Replace single-letter icons with Unicode symbols or small SVG icons:

| Node type | Current | New (Unicode) | Colour |
|---|---|---|---|
| Directory (collapsed) | `> D` | `📁` or `▸ ` with folder colour | `#64748b` |
| Directory (expanded) | `v D` | `📂` or `▾ ` with folder colour | `#64748b` |
| Test file | `T` | `🧪` or a beaker/flask symbol | `#4361ee` |
| Test case | `t` | `◆` (diamond) | `#22c55e` pass / `#ef4444` fail / `#94a3b8` unknown |
| Other file | `f` | `📄` | `#94a3b8` |
| Parse warning | `!` | `⚠` | `#f59e0b` |

**CRITICAL:** Use consistent, visually distinct symbols. The tree must be scannable at a glance.

#### 5b. Last Run Status on Test Nodes
After a run completes, annotate test nodes with their last result:
- Passed: green dot or checkmark `✓` next to test name.
- Failed: red dot or cross `✗`.
- Skipped: grey dash `—`.
- No data: no indicator.

Fetch from `run_test_results` of the most recent run that included this file. Cache in memory, invalidate on `RUNS_STATUS_CHANGED`.

New IPC channel:
- `IPC.EXPLORER_GET_LAST_RESULTS` → `'explorer:getLastResults'` — returns `Map<testTitle, status>` for a given project. Queries the most recent completed run's test results.

#### 5c. Search / Filter Bar
Add a search input at the top of the tree panel:
- Filters tree nodes by name (case-insensitive substring match).
- Matching nodes + their parent directories are shown, everything else hidden.
- Clear button (×) to reset filter.
- Debounce input: 200ms.

This is client-side filtering on the already-loaded tree — no new IPC needed.

#### 5d. Remove Disabled Stubs
- "Debug file" / "Debug test" → remove from context menu entirely (not implemented in v1, don't show dead buttons).
- "Set artifact policy" on file context menu → remove (already available in the Info tab of the detail pane).
- "Open in editor" → **make functional** — now opens the file in the code viewer (deliverable 3).

### 6. Run Detail Improvements

#### 6a. Test Search in Tests Tab
Add a search input above the test results list in RunDetailPage:
- Filters by test title (substring match).
- Useful when a run has 100+ tests.

#### 6b. Expandable Error Messages
Currently, error messages in the Tests tab are shown inline and may be truncated. Change to:
- Show first line of error inline.
- Click to expand full error message in a collapsible section.
- Error text in monospace font with preserved whitespace.
- "Copy error" button on hover.

#### 6c. Single-Test Rerun
In the Tests tab, each failed test row gets a small "Rerun" button:
- Starts a new run targeting just that test (using grep filter).
- Uses the same browser/environment as the original run.

### 7. Polish + Micro-Interactions

#### 7a. Loading States
Every page that fetches data should show a subtle loading skeleton (not a spinner):
- Dashboard stat cards: grey pulsing rectangles.
- Explorer tree: 5 grey bars of varying width.
- Runs list: 3 grey card outlines.

Use CSS animation (`@keyframes pulse`) on placeholder elements.

#### 7b. Empty States
Every list/page with no data should have a helpful empty state:
- **Dashboard (no runs):** "Run your first test" with a prominent Run button.
- **Explorer (no files):** "No test files found. Create one or record a test." with links to Recorder.
- **Runs (empty):** "No runs yet. Start a test from the Explorer or Dashboard."
- **Flaky (no flaky):** "No flaky tests detected. Great job!" with a green checkmark.

#### 7c. Breadcrumbs
Replace the flat "Explorer" / "Runs" / etc. page titles with breadcrumbs:
- Dashboard → Explorer → `tests/checkout/` (when a folder is selected)
- Dashboard → Runs → Run #abc123
- Navigable: clicking "Runs" in the breadcrumb goes to the runs list.

#### 7d. Consistent Button Styles
Audit all inline `style={}` overrides on buttons. Replace with CSS classes:
- `.btn-ghost` — transparent background, used for subtle actions.
- `.btn-icon` — square button, icon only, no label.
- `.btn-sm` — smaller padding, used inside cards/rows.
- Remove all `style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}` inline hacks.

#### 7e. Transitions
- Page transitions: subtle fade-in (200ms opacity) on route change.
- Sidebar active state: 150ms transition on background colour.
- Tree expand/collapse: 150ms height transition (or CSS `max-height` trick).
- Cards: 150ms box-shadow lift on hover.

---

## New IPC Channels Summary

| Channel | Direction | Purpose |
|---|---|---|
| `file:read` | invoke | Read test file content |
| `file:write` | invoke | Save test file content |
| `file:create` | invoke | Create new test/folder |
| `dashboard:getStats` | invoke | Aggregated dashboard statistics |
| `explorer:getLastResults` | invoke | Last run status per test |

Add these to the `IPC` constants object in `src/shared/types/ipc.ts`.

## New Files

| File | Purpose |
|---|---|
| `src/main/services/FileService.ts` | Secure file read/write within project root |
| `src/main/services/DashboardService.ts` | Aggregates stats from runs, explorer, flaky |
| `src/main/ipc/fileHandlers.ts` | IPC handlers for file:read, file:write, file:create |
| `src/main/ipc/dashboardHandlers.ts` | IPC handler for dashboard:getStats |
| `src/renderer/src/components/ProjectLayout.tsx` | Sidebar + content layout wrapper |
| `src/renderer/src/components/Sidebar.tsx` | Navigation sidebar component |
| `src/renderer/src/components/CodeViewer.tsx` | Syntax-highlighted code display |
| `src/renderer/src/components/CodeEditor.tsx` | Textarea-based code editor |
| `src/renderer/src/components/Breadcrumb.tsx` | Breadcrumb navigation |
| `src/renderer/src/components/SearchFilter.tsx` | Reusable search/filter input |
| `src/renderer/src/components/StatCard.tsx` | Dashboard statistic card |
| `src/renderer/src/components/LoadingSkeleton.tsx` | Skeleton loading placeholders |
| `src/renderer/src/pages/DashboardPage.tsx` | New project home page (replaces ProjectDetailPage health panel) |

## Modified Files

| File | Change |
|---|---|
| `src/shared/types/ipc.ts` | Add 5 new IPC channel constants + types |
| `src/renderer/src/App.tsx` | Wrap project routes in `ProjectLayout`, add Dashboard route |
| `src/renderer/src/App.css` | Sidebar styles, layout grid, new component styles, remove inline hacks |
| `src/renderer/src/pages/ExplorerPage.tsx` | Replace detail pane with code viewer, add search, fix icons, add inline run buttons |
| `src/renderer/src/pages/ProjectDetailPage.tsx` | Replace with DashboardPage (or rename) |
| `src/renderer/src/pages/RunDetailPage.tsx` | Test search, expandable errors, single-test rerun |
| `src/renderer/src/pages/RecorderPage.tsx` | Add "Open in Editor" post-recording action |
| `src/renderer/src/pages/RunsPage.tsx` | Remove header/back button (now in sidebar) |
| `src/renderer/src/pages/SettingsPage.tsx` | Remove header/back button |
| `src/renderer/src/pages/EnvironmentsPage.tsx` | Remove header/back button |
| `src/renderer/src/pages/FlakyTestsPage.tsx` | Remove header/back button |
| `src/renderer/src/pages/RunComparisonPage.tsx` | Remove header/back button |
| `src/renderer/src/components/HealthPanel.tsx` | Compact mode for dashboard embed |
| `src/main/services/ServiceContainer.ts` | Add FileService, DashboardService |
| `src/main/ipc/index.ts` | Register file + dashboard handlers |

## Implementation Order

1. **IPC channels + types** — add all 5 new channels to `src/shared/types/ipc.ts`.
2. **FileService + handlers** — backend file read/write with path validation.
3. **DashboardService + handler** — stats aggregation query.
4. **Explorer last results handler** — query recent test results per project.
5. **ProjectLayout + Sidebar** — the layout wrapper and navigation component.
6. **Routing refactor** — wrap all project routes in the layout, remove per-page headers.
7. **DashboardPage** — replace health-panel homepage with the new dashboard.
8. **Explorer overhaul** — icons, search bar, inline run buttons, remove stubs.
9. **CodeViewer + CodeEditor** — the detail pane replacement.
10. **New file creation** — make "New test file" and "New folder" functional.
11. **Quick run integration** — inline play buttons, keyboard shortcuts, last config memory.
12. **RunDetailPage improvements** — test search, expandable errors, single-test rerun.
13. **RecorderPage post-recording flow** — "Open in Editor" button.
14. **Polish** — loading skeletons, empty states, breadcrumbs, transitions.
15. **Button audit** — replace all inline styles with CSS classes.
16. **Full walkthrough test** — navigate every flow, verify no dead ends.

## Exit Criteria

- Opening a project lands on a useful dashboard with stats, recent runs, and quick actions — NOT a health panel.
- Health checks are visible as a compact indicator, not the main content.
- Sidebar navigation is persistent and shows the active page.
- Test files can be viewed with syntax highlighting in the Explorer detail pane.
- Test files can be edited and saved inline (Ctrl+S works).
- New test files can be created from the Explorer context menu.
- A test can be run in 1 click via the inline play button on tree nodes.
- A full test suite can be run in 1 click from the dashboard.
- The Explorer tree uses clear, visually distinct icons (not single letters).
- The Explorer has a search/filter bar.
- Test nodes show their last run status (pass/fail indicator).
- After recording a test, the user can open it in the editor immediately.
- No disabled stub buttons remain in context menus.
- All pages have proper loading skeletons and empty states.
- No inline `style={}` hacks on navigation buttons — all use CSS classes.
- The app builds with zero TypeScript errors.
