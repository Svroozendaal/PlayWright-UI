import { ERROR_CODES } from '../../../shared/types/ipc'

type ErrorBannerProps = {
  code: string
  message?: string
  onAction?: () => void
  actionLabel?: string
}

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  [ERROR_CODES.PROJECT_NOT_FOUND]: {
    title: 'Project not found on disk',
    description: 'The project folder may have been moved or deleted.',
  },
  [ERROR_CODES.PROJECT_EXISTS]: {
    title: 'Project already exists',
    description: 'This folder is already registered or contains a Playwright project.',
  },
  [ERROR_CODES.HEALTH_CHECK_FAILED]: {
    title: 'Health check failed',
    description: 'One or more health checks did not pass. See the Health Panel for details.',
  },
  [ERROR_CODES.CONFIG_NOT_READABLE]: {
    title: 'Playwright config could not be read',
    description:
      'testDir falls back to "tests/". Check playwright.config.ts for syntax errors.',
  },
  [ERROR_CODES.ACTIVE_RUN_EXISTS]: {
    title: 'A run is already in progress',
    description: 'Wait until the current run finishes before starting a new one.',
  },
  [ERROR_CODES.RUN_NOT_FOUND]: {
    title: 'Run not found',
    description: 'The requested run could not be found in the database.',
  },
  [ERROR_CODES.SECRETS_UNAVAILABLE]: {
    title: 'Keychain not available',
    description:
      'On Windows, secrets are stored in Credential Manager. Ensure the system keychain service is running.',
  },
  [ERROR_CODES.ENVIRONMENT_NOT_FOUND]: {
    title: 'Active environment not found',
    description: 'The selected environment file may have been deleted. Environment has been reset.',
  },
  [ERROR_CODES.RECORDER_ALREADY_RUNNING]: {
    title: 'Recorder already running',
    description: 'Only one codegen session can run at a time. Stop the current session first.',
  },
  [ERROR_CODES.INVALID_PATH]: {
    title: 'Invalid path',
    description: 'The specified file or directory path is not valid.',
  },
}

export function ErrorBanner({ code, message, onAction, actionLabel }: ErrorBannerProps): JSX.Element {
  const mapped = ERROR_MESSAGES[code]
  const title = mapped?.title ?? 'An error occurred'
  const description = mapped?.description ?? message ?? 'An unexpected error occurred.'

  return (
    <div className="error-banner">
      <div className="error-banner-content">
        <div className="error-banner-title">{title}</div>
        <div className="error-banner-description">
          {description}
          {message && mapped && <div className="error-banner-detail">{message}</div>}
        </div>
      </div>
      {onAction && actionLabel && (
        <button className="btn btn-danger" onClick={onAction} style={{ flexShrink: 0 }}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function WarningBanner({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="warning-banner">{children}</div>
}
