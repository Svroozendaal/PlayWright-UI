// IPC Envelope — the standard response wrapper for all IPC communication
export type IpcEnvelope<T> = {
  version: 1
  payload?: T
  error?: { code: string; message: string }
}

// All IPC channel constants — defined upfront for all phases.
// Handlers are registered incrementally per phase.
export const IPC = {
  // Projects (Phase 1)
  PROJECTS_LIST:            'projects:list',
  PROJECTS_CREATE:          'projects:create',
  PROJECTS_IMPORT:          'projects:import',
  PROJECTS_GET:             'projects:get',
  PROJECTS_OPEN:            'projects:open',
  PROJECTS_REMOVE:          'projects:remove',
  PROJECTS_UPDATE_SETTINGS: 'projects:updateSettings',

  // Dialog (Phase 1)
  DIALOG_OPEN_DIRECTORY:    'dialog:openDirectory',
  DIALOG_SAVE_FILE:         'dialog:saveFile',

  // Health (Phase 2)
  HEALTH_GET:               'health:get',
  HEALTH_REFRESH:           'health:refresh',
  HEALTH_GET_CONFIG:        'health:getConfig',

  // Explorer (Phase 3)
  EXPLORER_GET_TREE:        'explorer:getTree',
  EXPLORER_REFRESH:         'explorer:refresh',
  EXPLORER_GET_FILE_POLICY: 'explorer:getFilePolicy',
  EXPLORER_SET_FILE_POLICY: 'explorer:setFilePolicy',

  // Runs (Phase 4)
  RUNS_START:               'runs:start',
  RUNS_GET_ACTIVE:          'runs:getActive',
  RUNS_LIST:                'runs:list',
  RUNS_GET_BY_ID:           'runs:getById',
  RUNS_CANCEL:              'runs:cancel',
  RUNS_RERUN:               'runs:rerun',
  RUNS_RERUN_FAILED:        'runs:rerunFailed',
  RUNS_LOG_EVENT:           'runs:logEvent',
  RUNS_STATUS_CHANGED:      'runs:statusChanged',
  RUNS_GET_TEST_RESULTS:    'runs:getTestResults',
  RUNS_COMPARE:             'runs:compare',

  // Environments (Phase 6)
  ENVIRONMENTS_LIST:        'environments:list',
  ENVIRONMENTS_CREATE:      'environments:create',
  ENVIRONMENTS_UPDATE:      'environments:update',
  ENVIRONMENTS_DELETE:      'environments:delete',
  ENVIRONMENTS_CHANGED:     'environments:changed',

  // Secrets (Phase 6)
  SECRETS_SET:              'secrets:set',
  SECRETS_GET_MASKED:       'secrets:getMasked',
  SECRETS_DELETE:           'secrets:delete',

  // Recorder (Phase 6)
  RECORDER_START:           'recorder:start',
  RECORDER_STOP:            'recorder:stop',
  RECORDER_SAVE:            'recorder:save',
  RECORDER_STATUS:          'recorder:status',

  // Artifacts (Phase 5)
  ARTIFACTS_LIST_BY_RUN:    'artifacts:listByRun',
  ARTIFACTS_OPEN:           'artifacts:open',
  ARTIFACTS_OPEN_REPORT:    'artifacts:openReport',
  ARTIFACTS_SHOW_TRACE:     'artifacts:showTrace',

  // Flaky test tracking (Phase 6)
  FLAKY_LIST:               'flaky:list',
  FLAKY_TEST_HISTORY:       'flaky:testHistory',

  // Settings (Phase 7)
  SETTINGS_GET_APP_INFO:    'settings:getAppInfo',
  SETTINGS_GET:             'settings:get',
  SETTINGS_SET:             'settings:set',

  // File operations (Phase 8)
  FILE_READ:                'file:read',
  FILE_WRITE:               'file:write',
  FILE_CREATE:              'file:create',

  // Dashboard (Phase 8)
  DASHBOARD_GET_STATS:      'dashboard:getStats',

  // Explorer enhancements (Phase 8)
  EXPLORER_GET_LAST_RESULTS: 'explorer:getLastResults',
} as const

// Error codes for IpcEnvelope.error.code
export const ERROR_CODES = {
  PROJECT_NOT_FOUND:        'PROJECT_NOT_FOUND',
  PROJECT_EXISTS:           'PROJECT_EXISTS',
  HEALTH_CHECK_FAILED:      'HEALTH_CHECK_FAILED',
  CONFIG_NOT_READABLE:      'CONFIG_NOT_READABLE',
  ACTIVE_RUN_EXISTS:        'ACTIVE_RUN_EXISTS',
  RUN_NOT_FOUND:            'RUN_NOT_FOUND',
  SECRETS_UNAVAILABLE:      'SECRETS_UNAVAILABLE',
  ENVIRONMENT_NOT_FOUND:    'ENVIRONMENT_NOT_FOUND',
  RECORDER_ALREADY_RUNNING: 'RECORDER_ALREADY_RUNNING',
  INVALID_PATH:             'INVALID_PATH',
  UNKNOWN:                  'UNKNOWN',
} as const

// Domain types used across main and renderer
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
  value: string // JSON-encoded
}

// Health types (Phase 2)
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

// Wizard types (Phase 2)
export type WizardParams = {
  projectName: string
  rootPath: string
  browsers: string[]
  includeExampleTests: boolean
  includeAuth: boolean
  includePageObjects: boolean
  includeFixtures: boolean
}

// Run types (Phase 4)
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

// Environment types (Phase 6)
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

export type RecorderStatus = 'idle' | 'running'

// App info (Phase 7)
export type AppInfo = {
  databasePath: string
  version: string
  userDataPath: string
}

// Secrets types (Phase 6)
export type MaskedSecret = {
  key: string
  masked: string
}

// Flaky test tracking types (Phase 6)
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

// Run comparison types (Phase 6)
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

// Project settings update (Phase 6)
export type ProjectSettingsUpdate = {
  projectId: string
  defaultBrowser?: string | null
  activeEnvironment?: string | null
}

// Explorer types (Phase 3)
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
}

// File operations types (Phase 8)
export type FileReadResult = {
  content: string
  encoding: 'utf-8'
  size: number
  lastModified: string
}

// Dashboard types (Phase 8)
export type DashboardStats = {
  totalFiles: number
  totalTests: number
  passRate: number | null
  flakyCount: number
  recentRuns: RunRecord[]
}

// Explorer last run results (Phase 8)
export type TestStatusMap = Record<string, 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted'>
