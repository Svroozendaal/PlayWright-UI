# SKILL: Playwright JSON Reporter

## Purpose

Rules for capturing, parsing, and mapping Playwright's JSON reporter output.

## When to Use

- Phase 4: RunResultParser implementation
- Phase 5: Artifact path extraction, rerunFailed

## Capturing JSON Output

**Option A — stdout capture (simpler, recommended for v1):**
```
playwright test --reporter=json --reporter=html
```
JSON goes to stdout, HTML goes to `playwright-report/`. Capture stdout and write to `<runDir>/results.json`.

**Option B — file output (if supported by version):**
```
playwright test --reporter=json:<runDir>/results.json --reporter=html
```
Check during PoC if the version supports this syntax.

**Recommendation:** Start with Option A. Parse stdout for JSON after process closes.

## JSON Report Structure

```typescript
type PlaywrightJsonReport = {
  config: { rootDir: string }
  suites: PlaywrightSuite[]
  stats: { expected: number; skipped: number; unexpected: number }
}

type PlaywrightSuite = {
  title: string
  file: string                  // absolute path
  suites?: PlaywrightSuite[]    // nested describe blocks
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

## Result Parser

```typescript
export function parseJsonReport(reportPath: string, runId: string): RunTestResultRow[] {
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
        tracePath: lastResult.attachments.find(a => a.name === 'trace')?.path,
        screenshotPath: lastResult.attachments.find(a => a.name === 'screenshot')?.path,
        videoPath: lastResult.attachments.find(a => a.name === 'video')?.path,
      })
    }
    for (const child of suite.suites ?? []) processSuite(child, filePath)
  }

  for (const suite of report.suites) processSuite(suite, suite.file)
  return results
}
```

## Status Mapping

| Playwright status | App status |
|---|---|
| `'passed'` | `'passed'` |
| `'failed'` | `'failed'` |
| `'timedOut'` | `'timedOut'` |
| `'skipped'` | `'skipped'` |

## safeTitleForGrep

Regex-escape the test title for use with `--grep`:
```typescript
const safeTitleForGrep = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
```

This is stored in `run_test_results` and used by rerunFailed to build grep patterns.

## Attachment Paths

Attachments come directly from the JSON report — no filename matching needed:
- `trace` → `tracePath`
- `screenshot` → `screenshotPath`
- `video` → `videoPath`

## Edge Cases

- **Empty suites:** Some describe blocks may have no specs — skip them.
- **Nested describes:** Process recursively via `suite.suites`.
- **Template literal titles:** The regex extractor may miss these; the JSON reporter captures them correctly.
- **Multiple test results (retries):** Use `.at(-1)` to get the last result.

## Rules

1. **Parse JSON from file, not from stdout directly** — write stdout to file first, then parse.
2. **Use the last result per spec** — `spec.tests[0].results.at(-1)`.
3. **Always store `safeTitleForGrep`** — needed for Phase 5 rerunFailed.
4. **Artifact paths come from the report** — no filename guessing.
5. **Handle missing results.json gracefully** — indicates config-error, not test failure.
