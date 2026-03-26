import fs from 'fs'
import path from 'path'
import type Database from 'better-sqlite3'
import type { Environment, ResolvedEnv } from '../../shared/types/ipc'
import type { SecretsService } from './SecretsService'

export class EnvironmentService {
  private db: Database.Database
  private secretsService: SecretsService
  private cache = new Map<string, Environment[]>()

  constructor(db: Database.Database, secretsService: SecretsService) {
    this.db = db
    this.secretsService = secretsService
  }

  listEnvironments(projectId: string, rootPath: string): Environment[] {
    const cached = this.cache.get(projectId)
    if (cached) return cached

    const envDir = path.join(rootPath, 'environments')
    if (!fs.existsSync(envDir)) return []

    const files = fs.readdirSync(envDir).filter((f) => f.endsWith('.json'))
    const environments: Environment[] = []

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(envDir, file), 'utf8')
        const parsed = JSON.parse(content) as Partial<Environment>
        environments.push({
          name: parsed.name ?? file.replace('.json', ''),
          baseURL: parsed.baseURL ?? '',
          variables: parsed.variables ?? {},
          secretRefs: parsed.secretRefs ?? {},
        })
      } catch {
        // Skip invalid JSON files
      }
    }

    this.cache.set(projectId, environments)
    return environments
  }

  saveEnvironment(projectId: string, rootPath: string, env: Environment): void {
    const envDir = path.join(rootPath, 'environments')
    fs.mkdirSync(envDir, { recursive: true })

    const filePath = path.join(envDir, `${env.name}.json`)
    fs.writeFileSync(filePath, JSON.stringify(env, null, 2))
    this.invalidateCache(projectId)
  }

  async deleteEnvironment(projectId: string, rootPath: string, name: string): Promise<void> {
    const filePath = path.join(rootPath, 'environments', `${name}.json`)

    // Load env to find secret refs before deleting
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8')
        const env = JSON.parse(content) as Partial<Environment>
        // Delete all secrets for this environment
        if (env.secretRefs) {
          for (const key of Object.keys(env.secretRefs)) {
            await this.secretsService.deleteSecret(projectId, name, key)
          }
        }
      } catch {
        // Continue with deletion even if parsing fails
      }
      fs.unlinkSync(filePath)
    }

    // If this was the active environment, reset to null
    const project = this.db
      .prepare('SELECT activeEnvironment FROM projects WHERE id = ?')
      .get(projectId) as { activeEnvironment: string | null } | undefined

    if (project?.activeEnvironment === name) {
      this.db.prepare('UPDATE projects SET activeEnvironment = NULL WHERE id = ?').run(projectId)
    }

    this.invalidateCache(projectId)
  }

  async resolveForRun(
    projectId: string,
    rootPath: string,
    envName: string,
    overrides?: { baseURL?: string; env?: Record<string, string> }
  ): Promise<ResolvedEnv> {
    const environments = this.listEnvironments(projectId, rootPath)
    const env = environments.find((e) => e.name === envName)

    if (!env) {
      throw new EnvironmentNotFoundError(`Environment not found: ${envName}`)
    }

    // Resolve all secret refs
    const resolvedVars: Record<string, string> = { ...env.variables }

    for (const [key, ref] of Object.entries(env.secretRefs)) {
      const secret = await this.secretsService.getSecret(projectId, envName, key)
      if (secret) {
        resolvedVars[key] = secret
      }
    }

    // Apply overrides
    let baseURL = env.baseURL
    if (overrides?.baseURL) {
      baseURL = overrides.baseURL
    }

    if (overrides?.env) {
      Object.assign(resolvedVars, overrides.env)
    }

    return { baseURL, env: resolvedVars }
  }

  setActiveEnvironment(projectId: string, envName: string | null): void {
    this.db
      .prepare('UPDATE projects SET activeEnvironment = ? WHERE id = ?')
      .run(envName, projectId)
  }

  invalidateCache(projectId: string): void {
    this.cache.delete(projectId)
  }
}

export class EnvironmentNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentNotFoundError'
  }
}
