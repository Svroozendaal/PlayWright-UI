import {
  readPlaywrightConfig,
  type PlaywrightConfigSummary,
} from '../utils/playwrightConfigReader'

export class PlaywrightConfigService {
  private configCache = new Map<
    string,
    { summary: PlaywrightConfigSummary; cachedAt: number }
  >()

  get(projectId: string, rootPath: string): PlaywrightConfigSummary {
    const cached = this.configCache.get(projectId)
    if (cached && Date.now() - cached.cachedAt < 60_000) {
      return cached.summary
    }
    const summary = readPlaywrightConfig(rootPath)
    this.configCache.set(projectId, { summary, cachedAt: Date.now() })
    return summary
  }

  invalidateCache(projectId: string): void {
    this.configCache.delete(projectId)
  }

  invalidateAll(): void {
    this.configCache.clear()
  }
}
