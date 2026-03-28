import { API_ROUTES, IPC, type ApiEnvelope, type DirectoryBrowseResult } from '../../../shared/types/ipc'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
type QueryValue = string | number | boolean | null | undefined
type QueryMap = Record<string, QueryValue>
type RouteSpec = {
  method: HttpMethod
  path: string | ((payload: Record<string, unknown>) => string)
  query?: (payload: Record<string, unknown>) => QueryMap
  body?: (payload: Record<string, unknown>) => unknown
}

const API_BASE = '/api'

function assertPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }

  return payload as Record<string, unknown>
}

function getRequiredString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required field: ${key}`)
  }

  return value
}

function buildPath(template: string, params: Record<string, string>): string {
  return template.replace(/:([A-Za-z0-9_]+)/g, (_match, key: string) => {
    const value = params[key]
    if (!value) {
      throw new Error(`Missing required route param: ${key}`)
    }

    return encodeURIComponent(value)
  })
}

function buildUrl(path: string, query?: QueryMap): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') {
        continue
      }

      url.searchParams.set(key, String(value))
    }
  }

  return `${url.pathname}${url.search}`
}

async function request<T>(
  method: HttpMethod,
  path: string,
  options?: {
    body?: unknown
    query?: QueryMap
  }
): Promise<ApiEnvelope<T>> {
  const response = await fetch(buildUrl(path, options?.query), {
    method,
    headers:
      options?.body === undefined
        ? undefined
        : {
            'Content-Type': 'application/json',
          },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body),
  })

  return (await response.json()) as ApiEnvelope<T>
}

const channelMap: Record<string, RouteSpec> = {
  [IPC.PROJECTS_LIST]: {
    method: 'GET',
    path: API_ROUTES.PROJECTS_LIST,
  },
  [IPC.PROJECTS_CREATE]: {
    method: 'POST',
    path: API_ROUTES.PROJECTS_CREATE,
    body: (payload) => payload,
  },
  [IPC.PROJECTS_IMPORT]: {
    method: 'POST',
    path: API_ROUTES.PROJECTS_IMPORT,
    body: (payload) => payload,
  },
  [IPC.PROJECTS_GET]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.PROJECTS_GET, { id: getRequiredString(payload, 'id') }),
  },
  [IPC.PROJECTS_OPEN]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.PROJECTS_OPEN, { id: getRequiredString(payload, 'id') }),
  },
  [IPC.PROJECTS_REMOVE]: {
    method: 'DELETE',
    path: (payload) =>
      buildPath(API_ROUTES.PROJECTS_REMOVE, { id: getRequiredString(payload, 'id') }),
  },
  [IPC.PROJECTS_UPDATE_SETTINGS]: {
    method: 'PATCH',
    path: (payload) =>
      buildPath(API_ROUTES.PROJECTS_UPDATE_SETTINGS, {
        id: getRequiredString(payload, 'projectId'),
      }),
    body: (payload) => payload,
  },
  [IPC.HEALTH_GET]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.HEALTH_GET, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.HEALTH_REFRESH]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.HEALTH_REFRESH, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.HEALTH_GET_CONFIG]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.HEALTH_GET_CONFIG, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.EXPLORER_GET_TREE]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.EXPLORER_GET_TREE, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.EXPLORER_REFRESH]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.EXPLORER_REFRESH, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.EXPLORER_GET_FILE_POLICY]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.EXPLORER_GET_FILE_POLICY, {
        id: getRequiredString(payload, 'projectId'),
      }),
    query: (payload) => ({
      filePath: getRequiredString(payload, 'filePath'),
    }),
  },
  [IPC.EXPLORER_SET_FILE_POLICY]: {
    method: 'PUT',
    path: (payload) =>
      buildPath(API_ROUTES.EXPLORER_SET_FILE_POLICY, {
        id: getRequiredString(payload, 'projectId'),
      }),
    body: (payload) => ({
      filePath: getRequiredString(payload, 'filePath'),
      policy: payload['policy'],
    }),
  },
  [IPC.EXPLORER_GET_LAST_RESULTS]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.EXPLORER_GET_LAST_RESULTS, {
        id: getRequiredString(payload, 'projectId'),
      }),
  },
  [IPC.RUNS_START]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_START, { id: getRequiredString(payload, 'projectId') }),
    body: (payload) => payload,
  },
  [IPC.RUNS_GET_ACTIVE]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_GET_ACTIVE, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.RUNS_LIST]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_LIST, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.RUNS_GET_BY_ID]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_GET_BY_ID, { runId: getRequiredString(payload, 'runId') }),
  },
  [IPC.RUNS_CANCEL]: {
    method: 'DELETE',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_CANCEL, { runId: getRequiredString(payload, 'runId') }),
  },
  [IPC.RUNS_RERUN]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_RERUN, { runId: getRequiredString(payload, 'runId') }),
  },
  [IPC.RUNS_RERUN_FAILED]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_RERUN_FAILED, { runId: getRequiredString(payload, 'runId') }),
  },
  [IPC.RUNS_GET_TEST_RESULTS]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.RUNS_GET_TEST_RESULTS, { runId: getRequiredString(payload, 'runId') }),
  },
  [IPC.RUNS_COMPARE]: {
    method: 'GET',
    path: API_ROUTES.RUNS_COMPARE,
    query: (payload) => ({
      a: getRequiredString(payload, 'runIdA'),
      b: getRequiredString(payload, 'runIdB'),
    }),
  },
  [IPC.ARTIFACTS_OPEN]: {
    method: 'POST',
    path: API_ROUTES.ARTIFACTS_OPEN,
    body: (payload) => payload,
  },
  [IPC.ARTIFACTS_OPEN_REPORT]: {
    method: 'POST',
    path: API_ROUTES.ARTIFACTS_OPEN_REPORT,
    body: (payload) => payload,
  },
  [IPC.ARTIFACTS_SHOW_TRACE]: {
    method: 'POST',
    path: API_ROUTES.ARTIFACTS_SHOW_TRACE,
    body: (payload) => payload,
  },
  [IPC.ENVIRONMENTS_LIST]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.ENVIRONMENTS_LIST, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.ENVIRONMENTS_CREATE]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.ENVIRONMENTS_CREATE, { id: getRequiredString(payload, 'projectId') }),
    body: (payload) => ({
      environment: payload['environment'],
    }),
  },
  [IPC.ENVIRONMENTS_UPDATE]: {
    method: 'PUT',
    path: (payload) =>
      buildPath(API_ROUTES.ENVIRONMENTS_UPDATE, {
        envId:
          typeof payload['envId'] === 'string'
            ? payload['envId']
            : getRequiredString(payload['environment'] as Record<string, unknown>, 'name'),
      }),
    body: (payload) => ({
      projectId: getRequiredString(payload, 'projectId'),
      environment: payload['environment'],
    }),
  },
  [IPC.ENVIRONMENTS_DELETE]: {
    method: 'DELETE',
    path: (payload) =>
      buildPath(API_ROUTES.ENVIRONMENTS_DELETE, {
        envId:
          typeof payload['envId'] === 'string'
            ? payload['envId']
            : getRequiredString(payload, 'name'),
      }),
    query: (payload) => ({
      projectId: getRequiredString(payload, 'projectId'),
    }),
  },
  [IPC.SECRETS_SET]: {
    method: 'POST',
    path: API_ROUTES.SECRETS_SET,
    body: (payload) => payload,
  },
  [IPC.SECRETS_GET_MASKED]: {
    method: 'GET',
    path: API_ROUTES.SECRETS_GET_MASKED,
  },
  [IPC.SECRETS_DELETE]: {
    method: 'DELETE',
    path: API_ROUTES.SECRETS_DELETE,
    query: (payload) => payload as QueryMap,
  },
  [IPC.RECORDER_START]: {
    method: 'POST',
    path: (payload) =>
      buildPath(API_ROUTES.RECORDER_START, { id: getRequiredString(payload, 'projectId') }),
    body: (payload) => ({
      startUrl: payload['startUrl'],
      outputPath: payload['outputPath'],
      browser: payload['browser'],
    }),
  },
  [IPC.RECORDER_STOP]: {
    method: 'POST',
    path: API_ROUTES.RECORDER_STOP,
  },
  [IPC.RECORDER_SAVE]: {
    method: 'POST',
    path: API_ROUTES.RECORDER_SAVE,
    body: (payload) => payload,
  },
  [IPC.RECORDER_STATUS]: {
    method: 'GET',
    path: API_ROUTES.RECORDER_STATUS,
  },
  [IPC.FILE_READ]: {
    method: 'POST',
    path: API_ROUTES.FILE_READ,
    body: (payload) => payload,
  },
  [IPC.FILE_WRITE]: {
    method: 'POST',
    path: API_ROUTES.FILE_WRITE,
    body: (payload) => payload,
  },
  [IPC.FILE_CREATE]: {
    method: 'POST',
    path: API_ROUTES.FILE_CREATE,
    body: (payload) => payload,
  },
  [IPC.FLAKY_LIST]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.FLAKY_LIST, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.FLAKY_TEST_HISTORY]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.FLAKY_TEST_HISTORY, {
        id: getRequiredString(payload, 'projectId'),
        testTitle: getRequiredString(payload, 'testTitle'),
      }),
  },
  [IPC.DASHBOARD_GET_STATS]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.DASHBOARD_GET_STATS, { id: getRequiredString(payload, 'projectId') }),
  },
  [IPC.SETTINGS_GET_APP_INFO]: {
    method: 'GET',
    path: API_ROUTES.SETTINGS_GET_APP_INFO,
  },
  [IPC.SETTINGS_GET]: {
    method: 'GET',
    path: (payload) =>
      buildPath(API_ROUTES.SETTINGS_GET, { key: getRequiredString(payload, 'key') }),
  },
  [IPC.SETTINGS_SET]: {
    method: 'PUT',
    path: (payload) =>
      buildPath(API_ROUTES.SETTINGS_SET, { key: getRequiredString(payload, 'key') }),
    body: (payload) => ({
      value: payload['value'],
    }),
  },
}

export const api = {
  async get<T>(path: string, query?: QueryMap): Promise<ApiEnvelope<T>> {
    return request<T>('GET', path, { query })
  },

  async post<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return request<T>('POST', path, { body })
  },

  async put<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return request<T>('PUT', path, { body })
  },

  async patch<T>(path: string, body?: unknown): Promise<ApiEnvelope<T>> {
    return request<T>('PATCH', path, { body })
  },

  async delete<T>(path: string, query?: QueryMap): Promise<ApiEnvelope<T>> {
    return request<T>('DELETE', path, { query })
  },

  async browseDirectories(path?: string): Promise<ApiEnvelope<DirectoryBrowseResult>> {
    return request<DirectoryBrowseResult>('POST', API_ROUTES.DIRECTORIES_BROWSE, {
      body: path ? { path } : {},
    })
  },

  async invoke<T>(channel: string, payload?: unknown): Promise<ApiEnvelope<T>> {
    const spec = channelMap[channel]
    if (!spec) {
      throw new Error(`Unsupported API channel: ${channel}`)
    }

    const safePayload = assertPayload(payload)
    const path = typeof spec.path === 'function' ? spec.path(safePayload) : spec.path

    return request<T>(spec.method, path, {
      query: spec.query?.(safePayload),
      body: spec.body?.(safePayload),
    })
  },
}
