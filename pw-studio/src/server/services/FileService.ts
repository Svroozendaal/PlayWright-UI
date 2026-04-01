import * as fs from 'fs'
import * as path from 'path'

export class FileService {
  /**
   * Validates that filePath is within rootPath (prevents path traversal).
   */
  private validatePath(rootPath: string, filePath: string): string {
    const resolvedRoot = path.resolve(rootPath)
    const resolvedFile = path.resolve(rootPath, filePath)
    if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
      throw new Error('Path traversal detected: file path is outside project root')
    }
    return resolvedFile
  }

  readFile(rootPath: string, filePath: string): { content: string; encoding: 'utf-8'; size: number; lastModified: string } {
    const resolved = this.validatePath(rootPath, filePath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`)
    }
    const stat = fs.statSync(resolved)
    if (!stat.isFile()) {
      throw new Error(`Not a file: ${filePath}`)
    }
    const content = fs.readFileSync(resolved, 'utf-8')
    return {
      content,
      encoding: 'utf-8',
      size: stat.size,
      lastModified: stat.mtime.toISOString()
    }
  }

  writeFile(rootPath: string, filePath: string, content: string): void {
    const resolved = this.validatePath(rootPath, filePath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`File not found: ${filePath}`)
    }
    fs.writeFileSync(resolved, content, 'utf-8')
  }

  createFile(rootPath: string, filePath: string, content: string): void {
    const resolved = this.validatePath(rootPath, filePath)
    if (fs.existsSync(resolved)) {
      throw new Error(`File already exists: ${filePath}`)
    }
    const dir = path.dirname(resolved)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(resolved, content, 'utf-8')
  }

  createDirectory(rootPath: string, dirPath: string): void {
    const resolved = this.validatePath(rootPath, dirPath)
    if (fs.existsSync(resolved)) {
      throw new Error(`Path already exists: ${dirPath}`)
    }
    fs.mkdirSync(resolved, { recursive: true })
  }

  deleteFile(rootPath: string, filePath: string): void {
    const resolved = this.validatePath(rootPath, filePath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`Path not found: ${filePath}`)
    }
    const stat = fs.statSync(resolved)
    if (stat.isDirectory()) {
      fs.rmSync(resolved, { recursive: true, force: true })
    } else {
      fs.unlinkSync(resolved)
    }
  }

  renameFile(rootPath: string, filePath: string, newName: string): string {
    const resolved = this.validatePath(rootPath, filePath)
    if (!fs.existsSync(resolved)) {
      throw new Error(`Path not found: ${filePath}`)
    }
    if (newName.includes('/') || newName.includes('\\') || newName === '.' || newName === '..') {
      throw new Error('Invalid name')
    }
    const newPath = path.join(path.dirname(resolved), newName)
    const newRelative = path.relative(path.resolve(rootPath), newPath)
    this.validatePath(rootPath, newRelative)
    if (fs.existsSync(newPath)) {
      throw new Error(`A file or folder named "${newName}" already exists`)
    }
    fs.renameSync(resolved, newPath)
    return newRelative.replace(/\\/g, '/')
  }
}
