import { IpcMain, app } from 'electron'
import { tavily } from '@tavily/core'
import Groq from 'groq-sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'

export default function registerDeepResearch({ ipcMain }: { ipcMain: IpcMain }) {
  ipcMain.handle('execute-deep-research', async (event, { query, tavilyKey, groqKey }) => {
    try {
      if (!tavilyKey || !groqKey) {
        throw new Error('Missing API Keys. Please configure Tavily and Groq in the Command Center.')
      }

      event.sender.send('oracle-progress', {
        status: 'scanning',
        file: 'APEX and Tavily Neural Search Active...',
        totalFound: 1
      })

      const tvly = tavily({ apiKey: tavilyKey })
      const tavilyData = await tvly.search(query, {
        searchDepth: 'advanced',
        includeAnswer: true,
        maxResults: 5
      })
      const rawContext = tavilyData.results
        .map((r: any) => `Source: ${r.url}\nContent: ${r.content}`)
        .join('\n\n')

      event.sender.send('oracle-progress', {
        status: 'reading',
        file: 'Llama 3.1 Instantly Synthesizing Data...',
        totalFound: 2
      })

      const groq = new Groq({ apiKey: groqKey })
      const prompt = `
        You are an elite research analyst. Answer: "${query}".
        Output ONLY a JSON object with a key "summary" containing a detailed, well-formatted markdown summary of your findings.
        Context: ${rawContext}
        `

      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.1-8b-instant',
        response_format: { type: 'json_object' }
      })

      const jsonString =
        chatCompletion.choices[0]?.message?.content || '{"summary": "No data generated."}'
      const parsedData = JSON.parse(jsonString)
      const extractedSummary = parsedData.summary || 'No data generated.'

      event.sender.send('oracle-progress', {
        status: 'embedded',
        file: 'Research synthesis complete...',
        totalFound: 3
      })

      return { success: true, summary: extractedSummary }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle(
    'execute-deep-research-writer',
    async (event, { query, mode, fileName, groqKey, geminiKey, tavilyKey }) => {
      try {
        if (!groqKey) {
          throw new Error('Groq API Key missing.')
        }

        const groq = new Groq({ apiKey: groqKey })
        let context = ''

        if (mode === 'high') {
          if (!tavilyKey) throw new Error('Tavily API Key missing for High Mode.')
          
          event.sender.send(
            'deep-research-writer-stream',
            `*Initializing High Deep Research Engine...*\n*Gathering real-time internet context via Tavily...*\n\n`
          )
          
          const tvly = tavily({ apiKey: tavilyKey })
          const tavilyData = await tvly.search(query, {
            searchDepth: 'advanced',
            includeAnswer: true,
            maxResults: 6
          })
          context = tavilyData.results
            .map((r: any) => `Source: ${r.url}\nContent: ${r.content}`)
            .join('\n\n')
            
          event.sender.send(
            'deep-research-writer-stream',
            `*Context gathered successfully. Synthesizing comprehensive 300-line document...*\n\n---\n\n`
          )
        } else {
          event.sender.send(
            'deep-research-writer-stream',
            `*Initializing Normal Deep Research Engine...*\n*Synthesizing document...*\n\n---\n\n`
          )
        }

        const prompt = `
You are an elite, highly detailed expert AI writer. 
The user has requested a deeply researched, comprehensive, point-wise document (approximately 200-300 lines) on the following topic: "${query}".

${context ? `Use the following real-time internet context to make your document incredibly accurate and up-to-date:\n${context}\n\n` : ''}

CRITICAL RULES:
- Write a massive, comprehensive, well-structured document.
- Use markdown formatting, bullet points, headers, and bold text.
- STRICTLY use standard Markdown headers (e.g., # Heading, ## Subheading). DO NOT use underline styles (=== or ---) for headers.
- Use relevant emojis throughout the document to make it visually engaging and readable.
- Be highly analytical and detailed. Do not write a short summary.
- The output must be very long (target 200-300 lines).
`
        const modelName = mode === 'high' ? 'llama-3.3-70b-versatile' : 'llama-3.1-8b-instant'

        const chatCompletion = await groq.chat.completions.create({
          messages: [{ role: 'system', content: prompt }],
          model: modelName,
          stream: true
        })

        let fullContent = ''

        for await (const chunk of chatCompletion) {
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            event.sender.send('deep-research-writer-stream', content)
          }
        }

        event.sender.send('deep-research-writer-done')
        
        const safeName = query.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const defaultFileName = fileName || `${safeName}.md`

        const resolveSmartPath = (filePath: string): string => {
          if (path.isAbsolute(filePath)) return filePath
          const standardFolders = ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos']
          const lowerFileName = filePath.toLowerCase()
          for (const folder of standardFolders) {
            if (lowerFileName === folder) return app.getPath(folder as any)
            if (lowerFileName.startsWith(`${folder}/`) || lowerFileName.startsWith(`${folder}\\`)) {
              return path.join(app.getPath(folder as any), filePath.substring(folder.length + 1))
            }
          }
          return path.join(app.getPath('desktop'), filePath)
        }

        const targetPath = resolveSmartPath(defaultFileName)
        
        return { success: true, targetPath }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )

  ipcMain.handle(
    'save-deep-research-document',
    async (event, { query, content, fileName }) => {
      try {
        const safeName = query.substring(0, 30).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const defaultFileName = fileName || `${safeName}.md`

        const resolveSmartPath = (filePath: string): string => {
          if (path.isAbsolute(filePath)) return filePath
          const standardFolders = ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos']
          const lowerFileName = filePath.toLowerCase()
          for (const folder of standardFolders) {
            if (lowerFileName === folder) return app.getPath(folder as any)
            if (lowerFileName.startsWith(`${folder}/`) || lowerFileName.startsWith(`${folder}\\`)) {
              return path.join(app.getPath(folder as any), filePath.substring(folder.length + 1))
            }
          }
          return path.join(app.getPath('desktop'), filePath)
        }

        const targetPath = resolveSmartPath(defaultFileName)
        
        fs.writeFileSync(targetPath, content, 'utf-8')
        return { success: true, path: targetPath }
      } catch (error) {
        return { success: false, error: String(error) }
      }
    }
  )
}
