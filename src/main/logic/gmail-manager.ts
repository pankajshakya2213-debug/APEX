import { IpcMain, app, BrowserWindow } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import process from 'process'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'

const SCOPES = ['https://mail.google.com/']
const TOKEN_PATH = path.join(app.getPath('userData'), 'gmail_token.json')
const CREDENTIALS_FILENAME = 'credentials.json'
const SETTINGS_CREDENTIALS_PATH = path.join(app.getPath('userData'), CREDENTIALS_FILENAME)
const CREDENTIALS_SEARCH_DIRS = [
  app.getPath('userData'),
  process.cwd(),
  app.getAppPath(),
  path.dirname(process.execPath)
]

async function resolveCredentialsPath(): Promise<string> {
  for (const dir of CREDENTIALS_SEARCH_DIRS) {
    const candidate = path.join(dir, CREDENTIALS_FILENAME)
    try {
      await fs.access(candidate)
      return candidate
    } catch (_err) {
      continue
    }
  }
  throw new Error(
    `Missing Gmail OAuth client secret file. Create a Google OAuth desktop credential file named ${CREDENTIALS_FILENAME} and place it in one of these folders:\n` +
      CREDENTIALS_SEARCH_DIRS.map((dir) => `  • ${dir}`).join('\n')
  )
}

export default function registerGmailHandlers(ipcMain: IpcMain) {
  const buildCredentialsPayload = (clientId: string, clientSecret: string) =>
    JSON.stringify(
      {
        installed: {
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          auth_uri: 'https://accounts.google.com/o/oauth2/auth',
          token_uri: 'https://oauth2.googleapis.com/token',
          redirect_uris: ['http://localhost']
        }
      },
      null,
      2
    )

  async function loadOAuthClientConfig() {
    const credentialsPath = await resolveCredentialsPath()
    const content = await fs.readFile(credentialsPath, 'utf-8')
    const keys = JSON.parse(content)
    const key = keys.installed || keys.web
    return {
      clientId: key?.client_id || '',
      hasClientSecret: Boolean(key?.client_secret),
      source: credentialsPath
    }
  }

  async function loadSavedCredentialsIfExist(): Promise<any | null> {
    try {
      const content = await fs.readFile(TOKEN_PATH, 'utf-8')
      const credentials = JSON.parse(content)
      return google.auth.fromJSON(credentials)
    } catch (_err) {
      return null
    }
  }

  async function saveCredentials(client: any) {
    const credentialsPath = await resolveCredentialsPath()
    const content = await fs.readFile(credentialsPath, 'utf-8')
    const keys = JSON.parse(content)
    const key = keys.installed || keys.web
    if (!key || !key.client_id || !key.client_secret) {
      throw new Error(
        `${CREDENTIALS_FILENAME} must contain valid OAuth client_id and client_secret under the installed or web object.`
      )
    }

    const payload = JSON.stringify({
      type: 'authorized_user',
      client_id: key.client_id,
      client_secret: key.client_secret,
      refresh_token: client.credentials.refresh_token
    })
    await fs.writeFile(TOKEN_PATH, payload)
  }

  async function authorize(): Promise<{ client: any; isNewLogin: boolean }> {
    let client = await loadSavedCredentialsIfExist()
    if (client) return { client, isNewLogin: false }

    const credentialsPath = await resolveCredentialsPath()
    client = (await authenticate({ scopes: SCOPES, keyfilePath: credentialsPath })) as any
    if (client && client.credentials) {
      await saveCredentials(client)
    }

    const mainWindow = BrowserWindow.getAllWindows()[0]
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.setAlwaysOnTop(true)
      mainWindow.setAlwaysOnTop(false)
    }

    return { client, isNewLogin: true }
  }

  async function getGmailProfile(client: any) {
    const gmail = google.gmail({ version: 'v1', auth: client as any })
    const profile = await gmail.users.getProfile({ userId: 'me' })
    return profile.data
  }

  const makeEmail = (to: string, subject: string, body: string) => {
    const str = [`To: ${to}`, `Subject: ${subject}`, '', body].join('\n')
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  }

  function parseMessageParts(part: any, result = { text: '', html: '', attachments: [] as any[] }) {
    if (!part) return result

    if (part.filename && part.filename.length > 0) {
      result.attachments.push({
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body?.size
      })
    } else {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        result.text += Buffer.from(part.body.data, 'base64').toString('utf-8')
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        result.html += Buffer.from(part.body.data, 'base64').toString('utf-8')
      }
    }

    if (part.parts && part.parts.length > 0) {
      for (const childPart of part.parts) {
        parseMessageParts(childPart, result)
      }
    }
    return result
  }

  ipcMain.removeHandler('gmail-save-config')
  ipcMain.handle('gmail-save-config', async (_event, { clientId, clientSecret }) => {
    try {
      if (!clientId?.trim() || !clientSecret?.trim()) {
        return { success: false, error: 'Client ID and Client Secret are required.' }
      }
      await fs.mkdir(app.getPath('userData'), { recursive: true })
      await fs.writeFile(SETTINGS_CREDENTIALS_PATH, buildCredentialsPayload(clientId, clientSecret))
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('gmail-get-status')
  ipcMain.handle('gmail-get-status', async () => {
    const status = {
      configured: false,
      connected: false,
      email: '',
      clientId: '',
      source: ''
    }

    try {
      const config = await loadOAuthClientConfig()
      status.configured = Boolean(config.clientId && config.hasClientSecret)
      status.clientId = config.clientId
      status.source = config.source
    } catch (_e) {}

    try {
      const client = await loadSavedCredentialsIfExist()
      if (client) {
        const profile = await getGmailProfile(client)
        status.connected = true
        status.email = profile.emailAddress || ''
      }
    } catch (_e) {}

    return status
  })

  ipcMain.removeHandler('gmail-connect')
  ipcMain.handle('gmail-connect', async () => {
    try {
      const { client, isNewLogin } = await authorize()
      const profile = await getGmailProfile(client)
      return {
        success: true,
        isNewLogin,
        email: profile.emailAddress || ''
      }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('gmail-disconnect')
  ipcMain.handle('gmail-disconnect', async () => {
    try {
      await fs.rm(TOKEN_PATH, { force: true })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.removeHandler('gmail-read')
  ipcMain.handle('gmail-read', async (_event, maxResults = 5) => {
    try {
      const { client: auth, isNewLogin } = await authorize()
      if (!auth) throw new Error('Failed to authenticate.')

      const gmail = google.gmail({ version: 'v1', auth: auth as any })
      const res = await gmail.users.messages.list({ userId: 'me', maxResults })
      const messages = res.data.messages || []

      const prefix = isNewLogin
        ? '[SYSTEM NOTICE: Gmail Login was just completed successfully. Tell the user this before reading the emails.]\n\n'
        : ''

      if (!messages.length) return { speechText: prefix + '📭 Inbox is empty.', uiData: [] }

      let emailListForIris: string[] = []
      let uiDataArray: any[] = []

      for (const msg of messages) {
        const fullMsg = await gmail.users.messages.get({ userId: 'me', id: msg.id! })
        const headers = fullMsg.data.payload?.headers || []

        const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject'
        const from = headers.find((h) => h.name === 'From')?.value || 'Unknown'
        const date = headers.find((h) => h.name === 'Date')?.value || ''
        const snippet = fullMsg.data.snippet

        const parsed = parseMessageParts(fullMsg.data.payload)

        emailListForIris.push(`📧 From: ${from}\nSubject: ${subject}\nPreview: ${snippet}\n`)

        uiDataArray.push({
          id: fullMsg.data.id,
          from,
          subject,
          date,
          preview: snippet,
          body: parsed.html || parsed.text || snippet,
          attachments: parsed.attachments
        })
      }

      return {
        speechText: prefix + emailListForIris.join('\n---\n'),
        uiData: uiDataArray
      }
    } catch (e: any) {
      return { speechText: `❌ Gmail Error: ${e.message}`, uiData: [] }
    }
  })

  ipcMain.removeHandler('gmail-send')
  ipcMain.handle('gmail-send', async (_event, { to, subject, body }) => {
    try {
      const { client: auth, isNewLogin } = await authorize()
      if (!auth) throw new Error('Failed to authenticate.')
      const gmail = google.gmail({ version: 'v1', auth: auth as any })
      const raw = makeEmail(to, subject, body)

      await gmail.users.messages.send({ userId: 'me', requestBody: { raw } })

      const prefix = isNewLogin ? '[SYSTEM NOTICE: Login successful.]\n\n' : ''
      return prefix + `✅ Email successfully sent to ${to}.`
    } catch (e: any) {
      return `❌ Send Error: ${e.message}`
    }
  })

  ipcMain.removeHandler('gmail-draft')
  ipcMain.handle('gmail-draft', async (_event, { to, subject, body }) => {
    try {
      const { client: auth, isNewLogin } = await authorize()
      if (!auth) throw new Error('Failed to authenticate.')
      const gmail = google.gmail({ version: 'v1', auth: auth as any })
      const raw = makeEmail(to, subject, body)

      await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } })

      const prefix = isNewLogin ? '[SYSTEM NOTICE: Login successful.]\n\n' : ''
      return prefix + `✅ Draft created for ${to}. You can review it in your Gmail.`
    } catch (e: any) {
      return `❌ Draft Error: ${e.message}`
    }
  })
}
