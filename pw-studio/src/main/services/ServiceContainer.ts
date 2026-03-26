import type Database from 'better-sqlite3'
import type { BrowserWindow } from 'electron'
import { ProjectRegistryService } from './ProjectRegistryService'
import { SettingsService } from './SettingsService'
import { PlaywrightConfigService } from './PlaywrightConfigService'
import { ProjectHealthService } from './ProjectHealthService'
import { ProjectTemplateService } from './ProjectTemplateService'
import { FileWatchService } from './FileWatchService'
import { ProjectIndexService } from './ProjectIndexService'
import { RunService } from './RunService'
import { ArtifactService } from './ArtifactService'
import { SecretsService } from './SecretsService'
import { EnvironmentService } from './EnvironmentService'
import { RecorderService } from './RecorderService'
import { FlakyTrackingService } from './FlakyTrackingService'
import { RunComparisonService } from './RunComparisonService'
import { FileService } from './FileService'
import { DashboardService } from './DashboardService'

export type ServiceContainer = {
  db: Database.Database
  win: BrowserWindow
  projectRegistry: ProjectRegistryService
  settings: SettingsService
  playwrightConfig: PlaywrightConfigService
  projectHealth: ProjectHealthService
  projectTemplate: ProjectTemplateService
  fileWatch: FileWatchService
  projectIndex: ProjectIndexService
  run: RunService
  artifact: ArtifactService
  secrets: SecretsService
  environment: EnvironmentService
  recorder: RecorderService
  flakyTracking: FlakyTrackingService
  runComparison: RunComparisonService
  file: FileService
  dashboard: DashboardService
}

export function createServices(db: Database.Database, win: BrowserWindow): ServiceContainer {
  const projectRegistry = new ProjectRegistryService(db)
  const settings = new SettingsService(db)
  const playwrightConfig = new PlaywrightConfigService()
  const projectHealth = new ProjectHealthService(db, playwrightConfig)
  const projectTemplate = new ProjectTemplateService()
  const fileWatch = new FileWatchService(win, playwrightConfig, projectHealth)
  const projectIndex = new ProjectIndexService(playwrightConfig)
  const run = new RunService(db, win)
  const artifact = new ArtifactService(db)
  const secrets = new SecretsService()
  const environment = new EnvironmentService(db, secrets)
  const recorder = new RecorderService(win)
  const flakyTracking = new FlakyTrackingService(db)
  const runComparison = new RunComparisonService(db)
  const file = new FileService()
  const dashboard = new DashboardService(db, projectIndex, flakyTracking)

  // Wire run -> flaky tracking coupling
  run.setFlakyTracking(flakyTracking)

  // Wire watcher -> indexer -> renderer coupling
  fileWatch.setOnFileEvent(async (event) => {
    projectIndex.invalidate(event.projectId)
    const project = projectRegistry.getProject(event.projectId)
    if (project) {
      await projectIndex.buildIndex(event.projectId, project.rootPath)
      win.webContents.send('explorer:refresh', { projectId: event.projectId })
    }
  })

  return {
    db,
    win,
    projectRegistry,
    settings,
    playwrightConfig,
    projectHealth,
    projectTemplate,
    fileWatch,
    projectIndex,
    run,
    artifact,
    secrets,
    environment,
    recorder,
    flakyTracking,
    runComparison,
    file,
    dashboard,
  }
}
