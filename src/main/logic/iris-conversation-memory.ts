import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'

export default function registerConversationMemory({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const MEMORY_DIR = path.resolve(app.getPath('userData'), 'ConversationMemory')
  const FILE_PATH = path.join(MEMORY_DIR, 'conversations.json')

  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true })

  // Function to clean up messages older than 2 days
  const cleanupOldMessages = () => {
    try {
      if (!fs.existsSync(FILE_PATH)) return

      const data = fs.readFileSync(FILE_PATH, 'utf-8')
      let conversations: { role: string; content: string; timestamp: string }[] = data ? JSON.parse(data) : []

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      conversations = conversations.filter(msg => new Date(msg.timestamp) > twoDaysAgo)

      fs.writeFileSync(FILE_PATH, JSON.stringify(conversations, null, 2))
    } catch (err) {
      console.error('Error cleaning up old conversation messages:', err)
    }
  }

  // Run cleanup on registration
  cleanupOldMessages()

  // Set interval to run cleanup every 24 hours
  setInterval(cleanupOldMessages, 24 * 60 * 60 * 1000)

  ipcMain.handle('add-conversation-message', async (_event, msg) => {
    try {
      let conversations: { role: string; content: string; timestamp: string }[] = []
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        conversations = data ? JSON.parse(data) : []
      }

      const newEntry: { role: string; content: string; timestamp: string } = {
        role: msg.role,
        content: msg.parts[0].text,
        timestamp: new Date().toISOString()
      }
      conversations.push(newEntry)

      fs.writeFileSync(FILE_PATH, JSON.stringify(conversations, null, 2))
      return true
    } catch (err) {
      return false
    }
  })

  ipcMain.handle('get-conversation-history', async () => {
    try {
      if (fs.existsSync(FILE_PATH)) {
        const data = fs.readFileSync(FILE_PATH, 'utf-8')
        return data ? JSON.parse(data) : []
      }
    } catch (err) {}
    return []
  })

  ipcMain.handle('clear-old-conversations', async () => {
    cleanupOldMessages()
    return true
  })
}