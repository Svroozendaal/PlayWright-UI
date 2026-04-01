import { EventEmitter } from 'events'
import type Database from 'better-sqlite3'
import { WS_EVENTS } from '../../shared/types/ipc'
import type { BroadcastFn } from '../ws'
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
import { TestEditorService } from './TestEditorService'
import { BlockLibraryService } from './BlockLibraryService'
import { SuiteService } from './SuiteService'
import { PluginProjectService, PluginRuntimeService } from '../plugins/runtime'
import { registerCorePluginContributions } from '../plugins/core'

export type ServiceContainer = {
  db: Database.Database
  broadcast: BroadcastFn
  events: EventEmitter
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
  pluginRuntime: PluginRuntimeService
  blockLibrary: BlockLibraryService
  testEditor: TestEditorService
  suite: SuiteService
}

export function createServices(
  db: Database.Database,
  broadcast: BroadcastFn,
  events: EventEmitter
): ServiceContainer {
  const publish: BroadcastFn = (channel, data) => {
    broadcast(channel, data)
    events.emit(channel, data)
    events.emit('__all__', { channel, data })
  }

  const projectRegistry = new ProjectRegistryService(db)
  const settings = new SettingsService(db)
  const playwrightConfig = new PlaywrightConfigService()
  const projectHealth = new ProjectHealthService(db, playwrightConfig)
  const projectTemplate = new ProjectTemplateService()
  const secrets = new SecretsService()
  const environment = new EnvironmentService(db, secrets)
  const fileWatch = new FileWatchService(publish, playwrightConfig, projectHealth, environment)
  const projectIndex = new ProjectIndexService(playwrightConfig)
  const run = new RunService(db, publish)
  const artifact = new ArtifactService(db)
  const flakyTracking = new FlakyTrackingService(db)
  const runComparison = new RunComparisonService(db)
  const file = new FileService()
  const dashboard = new DashboardService(db, projectIndex, flakyTracking)
  const pluginRuntime = new PluginRuntimeService(new PluginProjectService())
  registerCorePluginContributions(pluginRuntime)
  const blockLibrary = new BlockLibraryService(pluginRuntime)
  const recorder = new RecorderService(publish, pluginRuntime)
  const testEditor = new TestEditorService(blockLibrary, pluginRuntime)
  const suite = new SuiteService()
  run.setFlakyTracking(flakyTracking)

  fileWatch.setOnFileEvent(async (event) => {
    projectIndex.invalidate(event.projectId)
    const project = projectRegistry.getProject(event.projectId)

    if (project) {
      await projectIndex.buildIndex(event.projectId, project.rootPath)
      publish(WS_EVENTS.EXPLORER_REFRESH, { projectId: event.projectId })
    }
  })

  return {
    db,
    broadcast: publish,
    events,
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
    pluginRuntime,
    blockLibrary,
    testEditor,
    suite,
  }
}
