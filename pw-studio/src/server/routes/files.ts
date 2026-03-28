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
]
