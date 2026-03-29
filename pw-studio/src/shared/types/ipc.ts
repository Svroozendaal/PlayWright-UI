export type ApiEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}

export type IpcEnvelope<T> = ApiEnvelope<T>

export const API_ROUTES = {
  PROJECTS_LIST: '/projects',
  PROJECTS_CREATE: '/projects',
  PROJECTS_IMPORT: '/projects/import',
  PROJECTS_GET: '/projects/:id',
  PROJECTS_OPEN: '/projects/:id/open',
  PROJECTS_REMOVE: '/projects/:id',
  PROJECTS_UPDATE_SETTINGS: '/projects/:id/settings',

  DIRECTORIES_BROWSE: '/directories/browse',

  HEALTH_GET: '/projects/:id/health',
  HEALTH_REFRESH: '/projects/:id/health/refresh',
  HEALTH_GET_CONFIG: '/projects/:id/config',

  EXPLORER_GET_TREE: '/projects/:id/explorer/tree',
  EXPLORER_REFRESH: '/projects/:id/explorer/refresh',
  EXPLORER_GET_FILE_POLICY: '/projects/:id/explorer/file-policy',
  EXPLORER_SET_FILE_POLICY: '/projects/:id/explorer/file-policy',
  EXPLORER_GET_LAST_RESULTS: '/projects/:id/explorer/last-results',

  TEST_EDITOR_LOAD: '/test-editor/load',
  TEST_EDITOR_SYNC_CODE: '/test-editor/sync-code',
  TEST_EDITOR_SAVE: '/test-editor/save',
  TEST_EDITOR_LIBRARY: '/test-editor/library',
  BLOCK_LIBRARY_TEMPLATES: '/block-library/templates',
  BLOCK_LIBRARY_PROJECT: '/projects/:id/block-library',

  RUNS_START: '/projects/:id/runs',
  RUNS_GET_ACTIVE: '/projects/:id/runs/active',
  RUNS_LIST: '/projects/:id/runs',
  RUNS_GET_BY_ID: '/runs/:runId',
  RUNS_CANCEL: '/runs/:runId',
  RUNS_RERUN: '/runs/:runId/rerun',
  RUNS_RERUN_FAILED: '/runs/:runId/rerun-failed',
  RUNS_GET_TEST_RESULTS: '/runs/:runId/results',
  RUNS_COMPARE: '/runs/compare',

  ARTIFACTS_LIST_BY_RUN: '/runs/:runId/artifacts',
  ARTIFACTS_OPEN: '/artifacts/open',
  ARTIFACTS_OPEN_REPORT: '/artifacts/open-report',
  ARTIFACTS_SHOW_TRACE: '/artifacts/show-trace',

  ENVIRONMENTS_LIST: '/projects/:id/environments',
  ENVIRONMENTS_CREATE: '/projects/:id/environments',
  ENVIRONMENTS_UPDATE: '/environments/:envId',
  ENVIRONMENTS_DELETE: '/environments/:envId',

  SECRETS_SET: '/secrets',
  SECRETS_GET_MASKED: '/secrets/masked',
  SECRETS_DELETE: '/secrets',

  RECORDER_START: '/projects/:id/recorder/start',
  RECORDER_STOP: '/recorder/stop',
  RECORDER_STATUS: '/recorder/status',
  RECORDER_SAVE: '/recorder/save',

  FILE_READ: '/files/read',
  FILE_WRITE: '/files/write',
  FILE_CREATE: '/files/create',

  FLAKY_LIST: '/projects/:id/flaky',
  FLAKY_TEST_HISTORY: '/projects/:id/flaky/:testTitle/history',

  DASHBOARD_GET_STATS: '/projects/:id/dashboard',

  SETTINGS_GET_APP_INFO: '/settings/app-info',
  SETTINGS_GET: '/settings/:key',
  SETTINGS_SET: '/settings/:key',

  OPENAPI: '/openapi.json',
} as const

export const WS_EVENTS = {
  RUNS_LOG_EVENT: 'runs:logEvent',
  RUNS_STATUS_CHANGED: 'runs:statusChanged',
  ENVIRONMENTS_CHANGED: 'environments:changed',
  HEALTH_REFRESH: 'health:refresh',
  RECORDER_STATUS: 'recorder:status',
  EXPLORER_REFRESH: 'explorer:refresh',
} as const

// Temporary compatibility export during the migration.
export const IPC = {
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_IMPORT: 'projects:import',
  PROJECTS_GET: 'projects:get',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_REMOVE: 'projects:remove',
  PROJECTS_UPDATE_SETTINGS: 'projects:updateSettings',

  DIALOG_OPEN_DIRECTORY: 'dialog:openDirectory',
  DIALOG_SAVE_FILE: 'dialog:saveFile',

  HEALTH_GET: 'health:get',
  HEALTH_REFRESH: 'health:refresh',
  HEALTH_GET_CONFIG: 'health:getConfig',

  EXPLORER_GET_TREE: 'explorer:getTree',
  EXPLORER_REFRESH: 'explorer:refresh',
  EXPLORER_GET_FILE_POLICY: 'explorer:getFilePolicy',
  EXPLORER_SET_FILE_POLICY: 'explorer:setFilePolicy',
  EXPLORER_GET_LAST_RESULTS: 'explorer:getLastResults',

  TEST_EDITOR_LOAD: 'testEditor:load',
  TEST_EDITOR_SYNC_CODE: 'testEditor:syncCode',
  TEST_EDITOR_SAVE: 'testEditor:save',
  TEST_EDITOR_LIBRARY: 'testEditor:library',
  BLOCK_LIBRARY_TEMPLATES: 'blockLibrary:templates',
  BLOCK_LIBRARY_TEMPLATES_SAVE: 'blockLibrary:templates:save',
  BLOCK_LIBRARY_PROJECT: 'blockLibrary:project',
  BLOCK_LIBRARY_PROJECT_SAVE: 'blockLibrary:project:save',

  RUNS_START: 'runs:start',
  RUNS_GET_ACTIVE: 'runs:getActive',
  RUNS_LIST: 'runs:list',
  RUNS_GET_BY_ID: 'runs:getById',
  RUNS_CANCEL: 'runs:cancel',
  RUNS_RERUN: 'runs:rerun',
  RUNS_RERUN_FAILED: 'runs:rerunFailed',
  RUNS_GET_TEST_RESULTS: 'runs:getTestResults',
  RUNS_COMPARE: 'runs:compare',
  RUNS_LOG_EVENT: WS_EVENTS.RUNS_LOG_EVENT,
  RUNS_STATUS_CHANGED: WS_EVENTS.RUNS_STATUS_CHANGED,

  ENVIRONMENTS_LIST: 'environments:list',
  ENVIRONMENTS_CREATE: 'environments:create',
  ENVIRONMENTS_UPDATE: 'environments:update',
  ENVIRONMENTS_DELETE: 'environments:delete',
  ENVIRONMENTS_CHANGED: WS_EVENTS.ENVIRONMENTS_CHANGED,

  SECRETS_SET: 'secrets:set',
  SECRETS_GET_MASKED: 'secrets:getMasked',
  SECRETS_DELETE: 'secrets:delete',

  RECORDER_START: 'recorder:start',
  RECORDER_STOP: 'recorder:stop',
  RECORDER_SAVE: 'recorder:save',
  RECORDER_STATUS: WS_EVENTS.RECORDER_STATUS,

  ARTIFACTS_LIST_BY_RUN: 'artifacts:listByRun',
  ARTIFACTS_OPEN: 'artifacts:open',
  ARTIFACTS_OPEN_REPORT: 'artifacts:openReport',
  ARTIFACTS_SHOW_TRACE: 'artifacts:showTrace',

  FLAKY_LIST: 'flaky:list',
  FLAKY_TEST_HISTORY: 'flaky:testHistory',

  SETTINGS_GET_APP_INFO: 'settings:getAppInfo',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_CREATE: 'file:create',

  DASHBOARD_GET_STATS: 'dashboard:getStats',
} as const

export const ERROR_CODES = {
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_EXISTS: 'PROJECT_EXISTS',
  HEALTH_CHECK_FAILED: 'HEALTH_CHECK_FAILED',
  CONFIG_NOT_READABLE: 'CONFIG_NOT_READABLE',
  ACTIVE_RUN_EXISTS: 'ACTIVE_RUN_EXISTS',
  RUN_NOT_FOUND: 'RUN_NOT_FOUND',
  SECRETS_UNAVAILABLE: 'SECRETS_UNAVAILABLE',
  ENVIRONMENT_NOT_FOUND: 'ENVIRONMENT_NOT_FOUND',
  RECORDER_ALREADY_RUNNING: 'RECORDER_ALREADY_RUNNING',
  INVALID_PATH: 'INVALID_PATH',
  INVALID_INPUT: 'INVALID_INPUT',
  TEST_CASE_NOT_FOUND: 'TEST_CASE_NOT_FOUND',
  SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
} as const

export type RegisteredProject = {
  id: string
  name: string
  rootPath: string
  source: 'created' | 'imported'
  createdAt: string
  updatedAt: string
  lastOpenedAt: string | null
  defaultBrowser: string | null
  activeEnvironment: string | null
}

export type AppSetting = {
  key: string
  value: string
}

export type HealthStatus = 'pass' | 'warning' | 'error'

export type HealthItem = {
  check: string
  status: HealthStatus
  message: string
  value?: string
  actionHint?: string
}

export type HealthSnapshot = {
  projectId: string
  checkedAt: string
  overallStatus: HealthStatus
  items: HealthItem[]
}

export type ProjectConfigSummary = {
  testDir: string
  projects: string[]
  outputDir: string
  readMethod: 'config' | 'regex' | 'fallback'
}

export type WizardParams = {
  projectName: string
  rootPath: string
  browsers: string[]
  includeExampleTests: boolean
  includeAuth: boolean
  includePageObjects: boolean
  includeFixtures: boolean
}

export type RunStatus = 'queued' | 'running' | 'passed' | 'failed' | 'config-error' | 'cancelled'

export type BrowserSelection =
  | { mode: 'single'; projectName: string }
  | { mode: 'all' }

export type RunRequest = {
  projectId: string
  target?: string
  targetPath?: string
  testTitleFilter?: string
  grepPattern?: string
  grepInvert?: boolean
  tagFilter?: string
  browser: BrowserSelection
  environment?: string
  headed?: boolean
  debug?: boolean
  baseURLOverride?: string
  extraEnv?: Record<string, string>
  streamLogs?: boolean
}

export type RunRecord = {
  id: string
  projectId: string
  status: RunStatus
  target: string | null
  targetPath: string | null
  browserJson: string | null
  environment: string | null
  headed: number
  debug: number
  commandJson: string | null
  exitCode: number | null
  reportPath: string | null
  logPath: string | null
  resultsPath: string | null
  runDir: string | null
  startedAt: string
  finishedAt: string | null
}

export type TestResultRecord = {
  id: string
  runId: string
  testTitle: string
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'
  duration: number | null
  errorMessage: string | null
  tracePath: string | null
  screenshotPath: string | null
  videoPath: string | null
  retryCount: number
  safeTitleForGrep?: string | null
}

export type LogEvent = {
  runId: string
  line: string
  timestamp: string
  source: 'stdout' | 'stderr'
}

export type Environment = {
  name: string
  baseURL: string
  variables: Record<string, string>
  secretRefs: Record<string, string>
}

export type ResolvedEnv = {
  baseURL: string
  env: Record<string, string>
}

export type CodegenOptions = {
  startUrl?: string
  outputPath: string
  browser?: string
}

export type CodegenExtractionKind = 'selector' | 'value' | 'url'

export type CodegenExtraction = {
  kind: CodegenExtractionKind
  name: string
  value: string
  occurrences: number
}

export type CodegenSuggestionKind =
  | 'structure'
  | 'selector'
  | 'cleanup'
  | 'maintainability'

export type CodegenSuggestion = {
  kind: CodegenSuggestionKind
  title: string
  detail: string
}

export type RecorderSaveResult = {
  outputPath: string
  testTitle: string
  transformed: boolean
  actionCount: number
  appliedChanges: string[]
  extractions: CodegenExtraction[]
  suggestions: CodegenSuggestion[]
}

export type RecorderStatus = 'idle' | 'running'

export type RecorderStatusEvent = {
  status: RecorderStatus
  error?: string
  result?: RecorderSaveResult
}

export type AppInfo = {
  databasePath: string
  version: string
  userDataPath: string
}

export type MaskedSecret = {
  key: string
  masked: string
}

export type FlakyTestRecord = {
  testTitle: string
  projectId: string
  totalRuns: number
  totalPasses: number
  totalFailures: number
  flakyCount: number
  lastSeenAt: string | null
}

export type TestHistoryEntry = {
  runId: string
  startedAt: string
  status: string
  duration: number | null
  retryCount: number
}

export type ComparedTest = {
  testTitle: string
  statusA: string | null
  statusB: string | null
  durationA: number | null
  durationB: number | null
  category: 'same' | 'fixed' | 'regressed' | 'new' | 'removed' | 'changed'
}

export type RunComparison = {
  runA: RunRecord
  runB: RunRecord
  tests: ComparedTest[]
}

export type ProjectSettingsUpdate = {
  projectId: string
  defaultBrowser?: string | null
  activeEnvironment?: string | null
}

export type ExplorerNodeType = 'directory' | 'file' | 'testFile' | 'testCase'

export type ExplorerNode = {
  id: string
  name: string
  type: ExplorerNodeType
  path: string
  children?: ExplorerNode[]
  parseState?: 'ok' | 'warning'
  parseWarning?: string
  testTitle?: string
  testCaseRef?: TestCaseRef
}

export type TestCaseRef = {
  ordinal: number
  testTitle: string
}

export type TestEditorMode = 'existing' | 'create'

export type SelectorStrategy = 'role' | 'text' | 'label' | 'test_id' | 'css'

export type SelectorSpec = {
  strategy: SelectorStrategy
  value: string
  name?: string
}

export type BlockDisplayValueSource =
  | 'url'
  | 'value'
  | 'selector.value'
  | 'selector.name'
  | 'code'

export type BlockDisplayConfig = {
  label: string
  detailSource: BlockDisplayValueSource
  quoteDetail?: boolean
  hideTitle?: boolean
  separator?: ': ' | ' '
}

export type RawCodeBlock = {
  id: string
  title: string
  templateId?: string
  kind: 'raw_code'
  code: string
}

export type GotoUrlBlock = {
  id: string
  title: string
  templateId?: string
  kind: 'goto_url'
  url: string
}

export type ClickElementBlock = {
  id: string
  title: string
  templateId?: string
  kind: 'click_element'
  selector: SelectorSpec
}

export type FillFieldBlock = {
  id: string
  title: string
  templateId?: string
  kind: 'fill_field'
  selector: SelectorSpec
  value: string
}

export type ExpectUrlBlock = {
  id: string
  title: string
  templateId?: string
  kind: 'expect_url'
  url: string
}

export type TestBlock =
  | RawCodeBlock
  | GotoUrlBlock
  | ClickElementBlock
  | FillFieldBlock
  | ExpectUrlBlock

export type TestBlockTemplate =
  | Omit<RawCodeBlock, 'id' | 'title'>
  | Omit<GotoUrlBlock, 'id' | 'title'>
  | Omit<ClickElementBlock, 'id' | 'title'>
  | Omit<FillFieldBlock, 'id' | 'title'>
  | Omit<ExpectUrlBlock, 'id' | 'title'>

export type BlockTemplate = {
  id: string
  name: string
  description: string
  category: string
  block: TestBlockTemplate
  display?: BlockDisplayConfig
}

export type ManagedBlockTemplate = BlockTemplate & {
  builtIn: boolean
}

export type TestEditorLibraryPayload = {
  templates: ManagedBlockTemplate[]
  availableTemplateIds: string[]
}

export type BlockLibraryProjectState = {
  templates: ManagedBlockTemplate[]
  includedTemplateIds: string[]
  globalTemplatesPath: string
  projectConfigPath: string | null
}

export type TestEditorTemplate = {
  callee: string
  extraArgs: string[]
  callbackStyle: 'arrow' | 'function'
  callbackParams: string
  callbackAsync: boolean
}

export type TestEditorDocument = {
  mode: TestEditorMode
  filePath: string
  testTitle: string
  blocks: TestBlock[]
  code: string
  warnings: string[]
  template: TestEditorTemplate
  testCaseRef?: TestCaseRef
}

export type FileReadResult = {
  content: string
  encoding: 'utf-8'
  size: number
  lastModified: string
}

export type DashboardStats = {
  totalFiles: number
  totalTests: number
  passRate: number | null
  flakyCount: number
  recentRuns: RunRecord[]
}

export type TestStatusMap = Record<string, 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'>

export type DirectoryEntry = {
  name: string
  type: 'directory' | 'file'
  path: string
}

export type DirectoryBrowseResult = {
  currentPath: string
  parentPath: string | null
  entries: DirectoryEntry[]
}
