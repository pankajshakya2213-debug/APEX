import { IpcMain, app } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

const getFileType = (name: string, isDirectory: boolean) => {
  if (isDirectory) return 'directory'

  const ext = path.extname(name).toLowerCase()
  const textExts = [
    '.txt',
    '.md',
    '.js',
    '.ts',
    '.jsx',
    '.tsx',
    '.json',
    '.html',
    '.css',
    '.py',
    '.java',
    '.c',
    '.cpp',
    '.h',
    '.csv',
    '.env',
    '.log',
    '.xml',
    '.yml',
    '.yaml'
  ]
  const imgExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp']
  const vidExts = ['.mp4', '.mkv', '.avi', '.mov', '.webm']
  const execExts = ['.exe', '.msi', '.bat', '.sh', '.app', '.dmg']

  if (textExts.includes(ext)) return 'text'
  if (imgExts.includes(ext)) return 'image'
  if (vidExts.includes(ext)) return 'video'
  if (execExts.includes(ext)) return 'executable'
  return 'unknown'
}

const getSystemPath = (name: any) => {
  // Manually set paths for SHAKY's system
  switch (name) {
    case 'desktop':
      return 'C:\\Users\\SHAKY\\OneDrive\\Desktop'
    case 'documents':
      return 'C:\\Users\\SHAKY\\OneDrive\\Documents'
    case 'downloads':
      return 'C:\\Users\\SHAKY\\Downloads'
    case 'music':
      return 'C:\\Users\\SHAKY\\Music'
    case 'pictures':
      return 'C:\\Users\\SHAKY\\OneDrive\\Pictures'
    case 'videos':
      return 'C:\\Users\\SHAKY\\Videos'
    case 'home':
      return 'C:\\Users\\SHAKY'
    case 'c':
    case 'c:':
    case 'drive':
    case 'root':
      return 'C:\\'
    case 'onedrive':
      return 'C:\\Users\\SHAKY\\OneDrive'
    case 'appdata':
      return 'C:\\Users\\SHAKY\\AppData\\Roaming'
    case 'localappdata':
      return 'C:\\Users\\SHAKY\\AppData\\Local'
    case 'temp':
      return 'C:\\Users\\SHAKY\\AppData\\Local\\Temp'
    case 'programfiles':
      return 'C:\\Program Files'
    case 'programfilesx86':
      return 'C:\\Program Files (x86)'
    case 'windows':
      return 'C:\\Windows'
    default:
      return 'C:\\Users\\SHAKY'
  }
}

export default function registerDirLoader(ipcMain: IpcMain) {
  ipcMain.handle('read-directory', async (_event, dirPath: string) => {
    try {
      let rawInput = dirPath.trim()
      let targetPath = rawInput
      const platform = os.platform()

      if (platform === 'win32' && /^[a-zA-Z]:?$/.test(rawInput)) {
        const driveLetter = rawInput.charAt(0).toUpperCase()
        targetPath = `${driveLetter}:\\`
      }
      else if (
        ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos', 'home', 'c', 'c:', 'drive', 'root'].includes(
          rawInput.toLowerCase()
        )
      ) {
        targetPath = getSystemPath(rawInput.toLowerCase())
      } else if (rawInput.toLowerCase() === 'home' || rawInput === '~') {
        targetPath = os.homedir()
      }
      else if (!path.isAbsolute(targetPath)) {
        targetPath = path.join(os.homedir(), rawInput)
      }


      try {
        const stats = await fs.stat(targetPath)
        if (!stats.isDirectory()) {
          return `Error: '${targetPath}' is a FILE. Use 'read_file' to read it.`
        }
      } catch (e) {
        return `Error: Directory not found at '${targetPath}'.`
      }

      const dirents = await fs.readdir(targetPath, { withFileTypes: true })

      const items = dirents
        .filter((d) => !d.name.startsWith('.'))
        .map((d) => ({
          name: d.name,
          path: path.join(targetPath, d.name),
          isDirectory: d.isDirectory(),
          ext: path.extname(d.name).toLowerCase()
        }))

      const itemsWithStats = await Promise.all(
        items.map(async (item) => {
          try {
            const stats = await fs.stat(item.path)
            return { ...item, mtime: stats.mtimeMs, size: stats.size }
          } catch {
            return { ...item, mtime: 0, size: 0 }
          }
        })
      )

      const sortedItems = itemsWithStats
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return b.mtime - a.mtime 
        })
        .slice(0, 150)

      const results = sortedItems.map((item) => {
        const type = getFileType(item.name, item.isDirectory)
        let infoString = ''

        if (item.isDirectory) {
          infoString = `[DIR] - Use 'read_directory("${item.name}")' to open this folder.`
        } else {
          const sizeKb = (item.size / 1024).toFixed(1) + 'KB'
          infoString = `[${type.toUpperCase()} | ${sizeKb}]`
        }

        return {
          name: item.name,
          type: type,
          path: item.path,
          info: infoString
        }
      })

      return JSON.stringify({
        directory: targetPath,
        items_found: results.length,
        content: results
      })
    } catch (err) {
      return `System Error: ${err}`
    }
  })
}
