import type { Express, Router } from 'express'
import type { RouteDefinition } from '../middleware/envelope'
import { registerRoute } from '../middleware/envelope'
import type { ServiceContainer } from '../services/ServiceContainer'
import { projectRoutes } from './projects'
import { directoryRoutes } from './directories'
import { healthRoutes } from './health'
import { explorerRoutes } from './explorer'
import { runRoutes } from './runs'
import { artifactRoutes } from './artifacts'
import { environmentRoutes } from './environments'
import { secretRoutes } from './secrets'
import { recorderRoutes } from './recorder'
import { fileRoutes } from './files'
import { flakyRoutes } from './flaky'
import { comparisonRoutes } from './comparison'
import { dashboardRoutes } from './dashboard'
import { settingsRoutes } from './settings'
import { testEditorRoutes } from './testEditor'
import { blockLibraryRoutes } from './blockLibrary'

export const allRoutes: RouteDefinition[] = [
  ...projectRoutes,
  ...directoryRoutes,
  ...healthRoutes,
  ...explorerRoutes,
  ...runRoutes,
  ...artifactRoutes,
  ...environmentRoutes,
  ...secretRoutes,
  ...recorderRoutes,
  ...fileRoutes,
  ...flakyRoutes,
  ...comparisonRoutes,
  ...dashboardRoutes,
  ...settingsRoutes,
  ...testEditorRoutes,
  ...blockLibraryRoutes,
]

export function registerAllRoutes(app: Express | Router, services: ServiceContainer): RouteDefinition[] {
  for (const route of allRoutes) {
    registerRoute(app, services, route)
  }

  return allRoutes
}
