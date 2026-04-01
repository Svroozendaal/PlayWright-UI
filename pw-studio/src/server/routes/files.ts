import { z } from 'zod'
import { API_ROUTES } from '../../shared/types/ipc'
import type { RouteDefinition } from '../middleware/envelope'
import { getProjectOrThrow } from './common'

const fileReadBodySchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
})

const fileWriteBodySchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
  content: z.string(),
})

const fileCreateBodySchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
  content: z.string().default(''),
  isDirectory: z.boolean().optional(),
})

const fileDeleteBodySchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
})

const fileRenameBodySchema = z.object({
  projectId: z.string().min(1),
  filePath: z.string().min(1),
  newName: z.string().min(1),
})

export const fileRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.FILE_READ,
    tags: ['Files'],
    summary: 'Read a file inside a project',
    operationId: 'readFile',
    schemas: { body: fileReadBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof fileReadBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      return services.file.readFile(project.rootPath, payload.filePath)
    },
  },
  {
    method: 'post',
    path: API_ROUTES.FILE_WRITE,
    tags: ['Files'],
    summary: 'Write a file inside a project',
    operationId: 'writeFile',
    schemas: { body: fileWriteBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof fileWriteBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      services.file.writeFile(project.rootPath, payload.filePath, payload.content)
      return { success: true }
    },
  },
  {
    method: 'post',
    path: API_ROUTES.FILE_CREATE,
    tags: ['Files'],
    summary: 'Create a file or directory inside a project',
    operationId: 'createFile',
    schemas: { body: fileCreateBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof fileCreateBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      if (payload.isDirectory) {
        services.file.createDirectory(project.rootPath, payload.filePath)
      } else {
        services.file.createFile(project.rootPath, payload.filePath, payload.content)
      }
      return { success: true }
    },
  },
  {
    method: 'post',
    path: API_ROUTES.FILE_DELETE,
    tags: ['Files'],
    summary: 'Delete a file or directory inside a project',
    operationId: 'deleteFile',
    schemas: { body: fileDeleteBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof fileDeleteBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      services.file.deleteFile(project.rootPath, payload.filePath)
      return { success: true }
    },
  },
  {
    method: 'post',
    path: API_ROUTES.FILE_RENAME,
    tags: ['Files'],
    summary: 'Rename a file or directory inside a project',
    operationId: 'renameFile',
    schemas: { body: fileRenameBodySchema },
    handler: ({ services, body }) => {
      const payload = body as z.infer<typeof fileRenameBodySchema>
      const project = getProjectOrThrow(services, payload.projectId)
      const newPath = services.file.renameFile(project.rootPath, payload.filePath, payload.newName)
      return { success: true, newPath }
    },
  },
]
