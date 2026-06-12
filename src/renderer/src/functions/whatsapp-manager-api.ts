export const sendWhatsAppMessage = async (name: string, message: string, filePath?: string) => {
  try {
    const settleShort = 900
    const settleMedium = 1800
    const settleLong = 3200

    if (filePath) {
      await window.electron.ipcRenderer.invoke('copy-file-to-clipboard', filePath)
      await window.electron.ipcRenderer.invoke('ghost-sequence', [{ type: 'wait', ms: settleShort }])
    }

    await window.electron.ipcRenderer.invoke('open-app', 'whatsapp')

    const navActions = [
      { type: 'wait', ms: 4500 },
      { type: 'click' },
      { type: 'wait', ms: settleShort },
      { type: 'press', key: 'n', modifiers: ['control'] },
      { type: 'wait', ms: settleMedium },
      { type: 'press', key: 'a', modifiers: ['control'] },
      { type: 'wait', ms: 500 },
      { type: 'press', key: 'backspace' },
      { type: 'wait', ms: 700 },
      { type: 'type', text: name },
      { type: 'wait', ms: 3200 },
      { type: 'press', key: 'down' },
      { type: 'wait', ms: settleShort },
      { type: 'press', key: 'enter' },
      { type: 'wait', ms: 2600 },
      { type: 'click' }
    ]
    await window.electron.ipcRenderer.invoke('ghost-sequence', navActions)
    await window.electron.ipcRenderer.invoke('ghost-sequence', [{ type: 'wait', ms: settleMedium }])

    if (filePath) {
      await window.electron.ipcRenderer.invoke('ghost-sequence', [
        { type: 'press', key: 'v', modifiers: ['control'] },
        { type: 'wait', ms: 5500 },
        { type: 'type', text: message },
        { type: 'wait', ms: settleLong },
        { type: 'press', key: 'enter' }
      ])
    } else {
      await window.electron.ipcRenderer.invoke('ghost-sequence', [
        { type: 'paste', text: message },
        { type: 'wait', ms: settleLong },
        { type: 'press', key: 'enter' }
      ])
    }

    return `✅ Message sent to ${name}.`
  } catch (error) {
    return '❌ Failed to send.'
  }
}

export const scheduleWhatsAppMessage = async (
  name: string,
  message: string,
  delayMinutes: number,
  filePath?: string
) => {
  if (!delayMinutes || delayMinutes <= 0) {
    return await sendWhatsAppMessage(name, message, filePath)
  }

 

  setTimeout(
    () => {
      window.electron.ipcRenderer.invoke('ghost-sequence', [{ type: 'type', text: '' }])

      sendWhatsAppMessage(name, message, filePath)
    },
    delayMinutes * 60 * 1000
  )

  return `✅ Scheduled! I will send the message to ${name} in ${delayMinutes} minutes.`
}
