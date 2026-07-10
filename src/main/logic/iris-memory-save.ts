import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'

export default function registerIpcHandlers({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const CHAT_DIR = path.resolve(app.getPath('userData'), 'Chat')
  const FILE_PATH = path.join(CHAT_DIR, 'iris_memory.json')

  ipcMain.removeHandler('add-message')
  ipcMain.removeHandler('get-history')

  ipcMain.handle('add-message', async (_event, msg) => {
    try {
      if (!fs.existsSync(CHAT_DIR)) fs.mkdirSync(CHAT_DIR, { recursive: true })

      let history: { role: string; content: string; timestamp: string }[] = []
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        history = data ? JSON.parse(data) : []
      }

      const newEntry: { role: string; content: string; timestamp: string } = {
        role: msg.role,
        content: msg.parts[0].text,
        timestamp: new Date().toISOString()
      }
      history.push(newEntry)

      if (history.length > 20) {
        const overflow = history.slice(0, history.length - 20)
        history = history.slice(-20)
        
        // Save overflow to monthly archive
        const currentMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
        const archiveFile = path.join(CHAT_DIR, `iris_memory_${currentMonth}.json`)
        
        let archive: any[] = []
        if (fs.existsSync(archiveFile)) {
           archive = JSON.parse(fs.readFileSync(archiveFile, 'utf-8') || '[]')
        }
        archive.push(...overflow)
        fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2))
        
        // Cleanup archives older than 3 months
        const files = fs.readdirSync(CHAT_DIR)
        const archiveFiles = files.filter(f => f.startsWith('iris_memory_') && f !== 'iris_memory.json').sort()
        if (archiveFiles.length > 3) {
           const toDelete = archiveFiles.slice(0, archiveFiles.length - 3)
           toDelete.forEach(file => {
             try { fs.unlinkSync(path.join(CHAT_DIR, file)) } catch(e) {}
           })
        }
      }

      fs.writeFileSync(FILE_PATH, JSON.stringify(history, null, 2))
      return true
    } catch (err) {
      return false
    }
  })

  ipcMain.handle('get-history', async () => {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        const raw = JSON.parse(data)
        return raw.map((m: any) => ({
          role: m.role === 'iris' ? 'model' : m.role,
          parts: [{ text: m.content }]
        }))
      }
    } catch (err) {}
    return []
  })
  ipcMain.handle('get-memory-archive', async (_event, monthsAgo: number) => {
    try {
       if (!fs.existsSync(CHAT_DIR)) return []
       const files = fs.readdirSync(CHAT_DIR)
       const archiveFiles = files.filter(f => f.startsWith('iris_memory_') && f !== 'iris_memory.json').sort((a,b) => b.localeCompare(a))
       
       if (monthsAgo >= 0 && monthsAgo < archiveFiles.length) {
         const targetFile = archiveFiles[monthsAgo]
         const data = fs.readFileSync(path.join(CHAT_DIR, targetFile), 'utf-8')
         return JSON.parse(data || '[]')
       }
       return []
    } catch (e) {
       return []
    }
  })
}
