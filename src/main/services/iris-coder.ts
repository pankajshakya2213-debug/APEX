import fs from 'fs'
import path from 'path'
import { IpcMain, App } from 'electron'
import { exec } from 'child_process'
import { GoogleGenAI } from '@google/genai'

export default function registerIrisCoder({ ipcMain, app }: { ipcMain: IpcMain; app: App }) {
  const PROJECTS_DIR = path.resolve(app.getPath('userData'), 'Projects')
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true })

  const resolveSmartPath = (filePath: string): string => {
    if (!filePath) return filePath
    const standardFolders = ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos']
    const lowerFileName = filePath.toLowerCase()
    
    // Check if it's already an absolute path
    if (path.isAbsolute(filePath)) return filePath

    for (const folder of standardFolders) {
      if (lowerFileName === folder) {
        return app.getPath(folder as any)
      }
      if (lowerFileName.startsWith(`${folder}/`) || lowerFileName.startsWith(`${folder}\\`)) {
        const relativePart = filePath.substring(folder.length + 1)
        return path.join(app.getPath(folder as any), relativePart)
      }
    }
    
    // If it's just a filename with no path, put it in Projects dir
    if (!filePath.includes('/') && !filePath.includes('\\')) {
       return path.join(PROJECTS_DIR, filePath)
    }

    // Otherwise resolve it relative to Projects dir
    return path.resolve(PROJECTS_DIR, filePath)
  }

  ipcMain.handle('start-live-coding', async (event, { prompt, filename, geminiKey }) => {
    try {
      const filePath = resolveSmartPath(filename)
      const dirName = path.dirname(filePath)
      if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true })

      fs.writeFileSync(filePath, '// Boss, connection established. Waiting for AI stream...\n')

      if (!geminiKey || geminiKey.trim() === '') {
        throw new Error('Missing Gemini API Key. Please configure it in the Command Center Vault.')
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey })

      const response = await ai.models.generateContentStream({
        model: 'gemini-3-flash-preview',
        contents: `You are an elite developer. Write the code for: "${prompt}". Output ONLY the raw code for the file ${filename}. Do NOT wrap it in markdown blockquotes.`
      })

      let fullCode = ''
      for await (const chunk of response) {
        if (chunk.text) {
          fullCode += chunk.text
          event.sender.send('live-code-chunk', chunk.text)
        }
      }

      fs.writeFileSync(filePath, fullCode)
      return { success: true, filePath }
    } catch (err) {
      event.sender.send('live-code-chunk', `\n\n❌ [SYSTEM FAILURE]: ${String(err)}`)
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle('open-in-vscode', async (_event, filePath) => {
    try {
      exec(`code "${filePath}"`)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
