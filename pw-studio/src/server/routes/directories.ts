import { execFile } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { z } from 'zod'
import { API_ROUTES, ERROR_CODES } from '../../shared/types/ipc'
import { ApiRouteError, type RouteDefinition } from '../middleware/envelope'
import { getDocumentsDir } from '../utils/paths'

const openDirectoryDialogBodySchema = z.object({
  startPath: z.string().optional(),
  title: z.string().optional(),
})

/**
 * Resolve the initial directory shown in the native folder dialog.
 *
 * Params:
 * requestedPath - Optional caller-provided starting directory.
 *
 * Returns:
 * Existing absolute directory path to use as the dialog's starting point.
 */
function getStartPath(requestedPath?: string): string {
  if (requestedPath && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isDirectory()) {
    return path.resolve(requestedPath)
  }

  const documentsDir = getDocumentsDir()
  if (fs.existsSync(documentsDir)) {
    return documentsDir
  }

  return path.resolve(os.homedir())
}

/**
 * Run a native system command and capture trimmed stdout.
 *
 * Params:
 * command - Executable to launch.
 * args - Argument vector passed directly to the command.
 *
 * Returns:
 * Trimmed stdout from the completed process.
 */
function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stdout.trim())
    })
  })
}

/**
 * Escape a value for inclusion in a single-quoted PowerShell string literal.
 *
 * Params:
 * value - Raw string value.
 *
 * Returns:
 * PowerShell-safe string contents.
 */
function escapePowerShellLiteral(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Escape a value for inclusion in an AppleScript string literal.
 *
 * Params:
 * value - Raw string value.
 *
 * Returns:
 * AppleScript-safe string contents.
 */
function escapeAppleScriptLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Decide whether a failed native dialog command means the user cancelled it.
 *
 * Params:
 * error - Error thrown by the child process invocation.
 *
 * Returns:
 * `true` when the failure maps to user cancellation.
 */
function isDialogCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    message.includes('user canceled') ||
    message.includes('user cancelled') ||
    message.includes('(-128)') ||
    message.includes('exit code: 1')
  )
}

/**
 * Check whether a command exists on the current Linux PATH.
 *
 * Params:
 * command - Executable name to probe.
 *
 * Returns:
 * `true` when the command is available.
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    await runCommand('sh', ['-lc', `command -v ${command}`])
    return true
  } catch {
    return false
  }
}

/**
 * Open the native Windows folder browser dialog.
 *
 * Params:
 * startPath - Initial directory for the dialog.
 * title - User-facing dialog description.
 *
 * Returns:
 * Selected absolute directory path, or `null` if cancelled.
 */
async function openWindowsDirectoryDialog(startPath: string, title: string): Promise<string | null> {
  const escapedStartPath = escapePowerShellLiteral(startPath)
  const escapedTitle = escapePowerShellLiteral(title)
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.OpenFileDialog',
    '$dialog.CheckFileExists = $false',
    '$dialog.CheckPathExists = $true',
    '$dialog.ValidateNames = $false',
    "$dialog.FileName = 'Select Folder'",
    `$dialog.InitialDirectory = '${escapedStartPath}'`,
    `$dialog.Title = '${escapedTitle}'`,
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    '  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    '  Write-Output ([System.IO.Path]::GetDirectoryName($dialog.FileName))',
    '}',
  ].join('; ')

  const selectedPath = await runCommand('powershell.exe', ['-NoProfile', '-STA', '-Command', script])
  return selectedPath || null
}

/**
 * Open the native macOS folder chooser.
 *
 * Params:
 * startPath - Initial directory for the dialog.
 * title - User-facing dialog prompt.
 *
 * Returns:
 * Selected absolute directory path, or `null` if cancelled.
 */
async function openMacDirectoryDialog(startPath: string, title: string): Promise<string | null> {
  const escapedStartPath = escapeAppleScriptLiteral(startPath)
  const escapedTitle = escapeAppleScriptLiteral(title)
  const script = [
    `set chosenFolder to choose folder with prompt "${escapedTitle}" default location POSIX file "${escapedStartPath}"`,
    'POSIX path of chosenFolder',
  ]

  try {
    const selectedPath = await runCommand('osascript', script.flatMap((line) => ['-e', line]))
    return selectedPath || null
  } catch (error) {
    if (isDialogCancelled(error)) {
      return null
    }

    throw error
  }
}

/**
 * Open a native Linux directory chooser using the first supported system tool.
 *
 * Params:
 * startPath - Initial directory for the dialog.
 * title - User-facing dialog title when supported.
 *
 * Returns:
 * Selected absolute directory path, or `null` if cancelled.
 */
async function openLinuxDirectoryDialog(startPath: string, title: string): Promise<string | null> {
  if (await commandExists('zenity')) {
    try {
      const selectedPath = await runCommand('zenity', [
        '--file-selection',
        '--directory',
        '--title',
        title,
        '--filename',
        startPath.endsWith(path.sep) ? startPath : `${startPath}${path.sep}`,
      ])
      return selectedPath || null
    } catch (error) {
      if (isDialogCancelled(error)) {
        return null
      }

      throw error
    }
  }

  if (await commandExists('kdialog')) {
    try {
      const selectedPath = await runCommand('kdialog', ['--getexistingdirectory', startPath, '--title', title])
      return selectedPath || null
    } catch (error) {
      if (isDialogCancelled(error)) {
        return null
      }

      throw error
    }
  }

  throw new ApiRouteError(
    ERROR_CODES.SERVER_UNAVAILABLE,
    'No native directory picker is available on this Linux system. Install zenity or kdialog.'
  )
}

/**
 * Open the operating system's native directory chooser and return the selected path.
 *
 * Params:
 * startPath - Initial directory for the dialog.
 * title - User-facing dialog title or prompt.
 *
 * Returns:
 * Selected absolute directory path, or `null` if cancelled.
 */
async function openNativeDirectoryDialog(startPath: string, title: string): Promise<string | null> {
  if (process.platform === 'win32') {
    return openWindowsDirectoryDialog(startPath, title)
  }

  if (process.platform === 'darwin') {
    return openMacDirectoryDialog(startPath, title)
  }

  return openLinuxDirectoryDialog(startPath, title)
}

export const directoryRoutes: RouteDefinition[] = [
  {
    method: 'post',
    path: API_ROUTES.DIALOG_OPEN_DIRECTORY,
    tags: ['Dialogs'],
    summary: 'Open the operating system native directory picker',
    operationId: 'openDirectoryDialog',
    schemas: {
      body: openDirectoryDialogBodySchema,
      response: z.string().nullable(),
    },
    handler: async ({ body }) => {
      const requestBody = body as z.infer<typeof openDirectoryDialogBodySchema>
      const startPath = getStartPath(requestBody.startPath)
      const title = requestBody.title?.trim() || 'Select Folder'
      return openNativeDirectoryDialog(startPath, title)
    },
  },
]
