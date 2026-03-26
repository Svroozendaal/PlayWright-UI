import type { ServiceContainer } from '../services/ServiceContainer'
import { registerProjectHandlers } from './projectHandlers'
import { registerDialogHandlers } from './dialogHandlers'
import { registerHealthHandlers } from './healthHandlers'
import { registerExplorerHandlers } from './explorerHandlers'
import { registerRunHandlers } from './runHandlers'
import { registerArtifactHandlers } from './artifactHandlers'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerSecretHandlers } from './secretHandlers'
import { registerEnvironmentHandlers } from './environmentHandlers'
import { registerRecorderHandlers } from './recorderHandlers'
import { registerFlakyHandlers } from './flakyHandlers'
import { registerComparisonHandlers } from './comparisonHandlers'
import { registerFileHandlers } from './fileHandlers'
import { registerDashboardHandlers } from './dashboardHandlers'

export function registerAllHandlers(services: ServiceContainer): void {
  registerProjectHandlers(services)
  registerDialogHandlers(services)
  registerHealthHandlers(services)
  registerExplorerHandlers(services)
  registerRunHandlers(services)
  registerArtifactHandlers(services)
  registerSettingsHandlers(services)
  registerSecretHandlers(services)
  registerEnvironmentHandlers(services)
  registerRecorderHandlers(services)
  registerFlakyHandlers(services)
  registerComparisonHandlers(services)
  registerFileHandlers(services)
  registerDashboardHandlers(services)
}
