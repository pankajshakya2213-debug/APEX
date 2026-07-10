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

  // If it passes all security blocklists, it's safe to modify
  return true
}

const resolveSmartPath = (filePath: string): string => {
  if (!filePath) return filePath
  const standardFolders = ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos']
  const lowerFileName = filePath.toLowerCase()
  for (const folder of standardFolders) {
    if (lowerFileName === folder) {
      return app.getPath(folder as any)
    }
    if (lowerFileName.startsWith(`${folder}/`) || lowerFileName.startsWith(`${folder}\\`)) {
      const relativePart = filePath.substring(folder.length + 1)
      return path.join(app.getPath(folder as any), relativePart)
    }
  }
  return path.resolve(filePath)
}

export default function registerFileOps(ipcMain: IpcMain) {
  ipcMain.handle('file-ops', async (_event, { operation, sourcePath, destPath }) => {

    try {
      const resolvedSource = resolveSmartPath(sourcePath)
      const resolvedDest = destPath ? resolveSmartPath(destPath) : undefined

      // 🚨 SAFETY CHECK: Ensure paths are safe before any operation
      if (!isPathSafe(resolvedSource)) {
        return `🚨 SECURITY BLOCKED: Cannot modify system files or protected paths.`
      }
      if (resolvedDest && !isPathSafe(resolvedDest)) {
        return `🚨 SECURITY BLOCKED: Cannot modify system files or protected paths.`
      }

      switch (operation) {
        case 'copy':
          if (!resolvedDest) return 'Error: Destination path required for copy.'
          await fs.cp(resolvedSource, resolvedDest, { recursive: true })
          return `Success: Copied to ${resolvedDest}`

        case 'move':
          if (!resolvedDest) return 'Error: Destination path required for move.'
          await fs.rename(resolvedSource, resolvedDest)
          return `Success: Moved to ${resolvedDest}`

        case 'delete':
          await fs.rm(resolvedSource, { recursive: true, force: true })
          return `Success: Deleted ${resolvedSource}`

        default:
          return `Error: Unknown operation '${operation}'`
      }
    } catch (err) {
      return `System Error: ${err}`
    }
  })

  ipcMain.handle('create-directory', async (_event, dirPath: string) => {
    try {
      const resolvedDir = resolveSmartPath(dirPath)
      if (!isPathSafe(resolvedDir)) {
        return { success: false, error: '🚨 SECURITY BLOCKED: Cannot create directory in protected location.' }
      }

      await fs.mkdir(resolvedDir, { recursive: true })
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
