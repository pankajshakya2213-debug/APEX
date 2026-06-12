import { IpcMain, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

// 🚨 SAFETY FIRST: Protected paths that APEX cannot modify
const PROTECTED_PATHS = [
  'C:\\Windows',
  'C:\\Program Files',
  'C:\\Program Files (x86)',
  'C:\\System32',
  'C:\\SysWOW64',
  '/System',
  '/usr',
  '/bin',
  '/sbin',
  '/etc'
]

// 🚨 SAFETY FIRST: File extensions that APEX cannot modify
const PROTECTED_EXTENSIONS = [
  '.exe', '.dll', '.sys', '.drv', '.ocx', '.scr',
  '.msi', '.msp', '.msm', '.app', '.dmg', '.pkg',
  '.deb', '.rpm', '.iso', '.img', '.vhd', '.vhdx'
]

// 🚨 SAFETY FIRST: Check if path is safe to modify
const isPathSafe = (filePath: string): boolean => {
  const normalizedPath = path.resolve(filePath).toLowerCase()

  // Check protected system paths
  for (const protectedPath of PROTECTED_PATHS) {
    if (normalizedPath.startsWith(protectedPath.toLowerCase())) {
      return false
    }
  }

  // Check protected file extensions
  const ext = path.extname(filePath).toLowerCase()
  if (PROTECTED_EXTENSIONS.includes(ext)) {
    return false
  }

  // Allow only user directories and safe paths
  const homeDir = os.homedir().toLowerCase()
  const allowedPaths = [
    homeDir,
    path.join(homeDir, 'Desktop').toLowerCase(),
    path.join(homeDir, 'Documents').toLowerCase(),
    path.join(homeDir, 'Downloads').toLowerCase(),
    path.join(homeDir, 'Music').toLowerCase(),
    path.join(homeDir, 'Pictures').toLowerCase(),
    path.join(homeDir, 'Videos').toLowerCase(),
    app.getPath('userData').toLowerCase()
  ]

  return allowedPaths.some(allowedPath => normalizedPath.startsWith(allowedPath))
}

export default function registerFileOps(ipcMain: IpcMain) {
  ipcMain.handle('file-ops', async (_event, { operation, sourcePath, destPath }) => {

    try {
      // 🚨 SAFETY CHECK: Ensure paths are safe before any operation
      if (!isPathSafe(sourcePath)) {
        return `🚨 SECURITY BLOCKED: Cannot modify system files or protected paths.`
      }
      if (destPath && !isPathSafe(destPath)) {
        return `🚨 SECURITY BLOCKED: Cannot modify system files or protected paths.`
      }

      switch (operation) {
        case 'copy':
          if (!destPath) return 'Error: Destination path required for copy.'
          await fs.cp(sourcePath, destPath, { recursive: true })
          return `Success: Copied to ${destPath}`

        case 'move':
          if (!destPath) return 'Error: Destination path required for move.'
          await fs.rename(sourcePath, destPath)
          return `Success: Moved to ${destPath}`

        case 'delete':
          await fs.rm(sourcePath, { recursive: true, force: true })
          return `Success: Deleted ${sourcePath}`

        default:
          return `Error: Unknown operation '${operation}'`
      }
    } catch (err) {
      return `System Error: ${err}`
    }
  })

  ipcMain.handle('create-directory', async (_event, dirPath: string) => {
    try {
      if (!isPathSafe(dirPath)) {
        return { success: false, error: '🚨 SECURITY BLOCKED: Cannot create directory in protected location.' }
      }

      const resolvedPath = path.resolve(dirPath)
      await fs.mkdir(resolvedPath, { recursive: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
