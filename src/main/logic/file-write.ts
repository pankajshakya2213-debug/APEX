import { IpcMain, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

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

const PROTECTED_EXTENSIONS = [
  '.exe',
  '.dll',
  '.sys',
  '.drv',
  '.ocx',
  '.scr',
  '.msi',
  '.msp',
  '.msm',
  '.app',
  '.dmg',
  '.pkg',
  '.deb',
  '.rpm',
  '.iso',
  '.img',
  '.vhd',
  '.vhdx'
]

const isPathSafe = (filePath: string): boolean => {
  const normalizedPath = path.resolve(filePath).toLowerCase()
  const homeDir = os.homedir().toLowerCase()

  for (const protectedPath of PROTECTED_PATHS) {
    if (normalizedPath.startsWith(protectedPath.toLowerCase())) {
      return false
    }
  }

  const ext = path.extname(filePath).toLowerCase()
  if (PROTECTED_EXTENSIONS.includes(ext)) {
    return false
  }

  // If it passes all security blocklists, it's safe to modify
  return true
}

export default function registerFileWrite(ipcMain: IpcMain) {
  ipcMain.handle('write-file', async (_event, { fileName, content }) => {
    try {
      let isAbsolutePath = fileName.includes('/') || fileName.includes('\\')
      let targetPath = isAbsolutePath ? fileName : path.join(app.getPath('desktop'), fileName)

      // Smart path resolution for standard folders
      const standardFolders = ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos']
      const lowerFileName = fileName.toLowerCase()
      for (const folder of standardFolders) {
        if (lowerFileName.startsWith(`${folder}/`) || lowerFileName.startsWith(`${folder}\\`)) {
          const relativePart = fileName.substring(folder.length + 1)
          targetPath = path.join(app.getPath(folder as any), relativePart)
          isAbsolutePath = true
          break
        }
      }

      // 🚨 SAFETY CHECK: Ensure path is safe before writing
      if (!isPathSafe(targetPath)) {
        return `🚨 SECURITY BLOCKED: Cannot write to system files or protected paths.`
      }

      await fs.writeFile(targetPath, content, 'utf-8')
      return `Success. File saved to: ${targetPath}`
    } catch (err) {
      return `Error writing file: ${err}`
    }
  })
}
