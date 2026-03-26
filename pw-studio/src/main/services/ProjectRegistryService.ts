import crypto from 'crypto'
import fs from 'fs'
import type Database from 'better-sqlite3'
import type { RegisteredProject } from '../../shared/types/ipc'

export class ProjectRegistryService {
  private db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listProjects(): RegisteredProject[] {
    return this.db
      .prepare('SELECT * FROM projects ORDER BY lastOpenedAt DESC, updatedAt DESC')
      .all() as RegisteredProject[]
  }

  getProject(id: string): RegisteredProject | undefined {
    return this.db
      .prepare('SELECT * FROM projects WHERE id = ?')
      .get(id) as RegisteredProject | undefined
  }

  addProject(name: string, rootPath: string, source: 'created' | 'imported'): RegisteredProject {
    const now = new Date().toISOString()
    const project: RegisteredProject = {
      id: crypto.randomUUID(),
      name,
      rootPath,
      source,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: null,
      defaultBrowser: null,
      activeEnvironment: null,
    }

    this.db
      .prepare(
        `INSERT INTO projects (id, name, rootPath, source, createdAt, updatedAt, lastOpenedAt, defaultBrowser, activeEnvironment)
         VALUES (@id, @name, @rootPath, @source, @createdAt, @updatedAt, @lastOpenedAt, @defaultBrowser, @activeEnvironment)`
      )
      .run(project)

    return project
  }

  importProject(rootPath: string): RegisteredProject {
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Path does not exist: ${rootPath}`)
    }

    const stat = fs.statSync(rootPath)
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${rootPath}`)
    }

    // Check if already registered
    const existing = this.db
      .prepare('SELECT * FROM projects WHERE rootPath = ?')
      .get(rootPath) as RegisteredProject | undefined

    if (existing) {
      throw new Error(`Project already registered at: ${rootPath}`)
    }

    // Use folder name as project name
    const name = rootPath.split(/[\\/]/).pop() ?? 'Unnamed Project'
    return this.addProject(name, rootPath, 'imported')
  }

  openProject(id: string): RegisteredProject {
    const project = this.getProject(id)
    if (!project) {
      throw new Error(`Project not found: ${id}`)
    }

    if (!fs.existsSync(project.rootPath)) {
      throw new Error(`Project path no longer exists: ${project.rootPath}`)
    }

    const now = new Date().toISOString()
    this.db
      .prepare('UPDATE projects SET lastOpenedAt = ?, updatedAt = ? WHERE id = ?')
      .run(now, now, id)

    return { ...project, lastOpenedAt: now, updatedAt: now }
  }

  removeProject(id: string): void {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id)
    if (result.changes === 0) {
      throw new Error(`Project not found: ${id}`)
    }
  }
}
