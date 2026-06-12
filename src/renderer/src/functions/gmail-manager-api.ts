export const readEmails = async (maxResults: number = 5) => {
  try {
    const result: any = await window.electron.ipcRenderer.invoke('gmail-read', maxResults)
    const message = result?.speechText || 'Inbox loaded.'
    const emails = Array.isArray(result?.uiData) ? result.uiData : []
    const success = !message?.startsWith('❌') && !message?.startsWith('System Error')

    const event = new CustomEvent('show-emails', {
      detail: { emails, message, success }
    })
    window.dispatchEvent(event)

    return message
  } catch (err: any) {
    const message = `System Error: Could not read emails. ${err?.message || ''}`.trim()
    const event = new CustomEvent('show-emails', {
      detail: { emails: [], message, success: false }
    })
    window.dispatchEvent(event)
    return message
  }
}

export const sendEmail = async (to: string, subject: string, body: string) => {
  try {
    return await window.electron.ipcRenderer.invoke('gmail-send', { to, subject, body })
  } catch (err) {
    return `System Error: Could not send email.`
  }
}

export const draftEmail = async (to: string, subject: string, body: string) => {
  try {
    return await window.electron.ipcRenderer.invoke('gmail-draft', { to, subject, body })
  } catch (err) {
    return `System Error: Could not draft email.`
  }
}
