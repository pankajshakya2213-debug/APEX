import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      ipcRenderer: {
        ...electronAPI.ipcRenderer,
        invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
        onUpdateAvailable: (callback: any) => {
          ipcRenderer.on('update-available', callback)
          return () => ipcRenderer.removeListener('update-available', callback)
        },
        onUpdateNotAvailable: (callback: any) => {
          ipcRenderer.on('update-not-available', callback)
          return () => ipcRenderer.removeListener('update-not-available', callback)
        },
        onUpdateError: (callback: any) => {
          ipcRenderer.on('update-error', callback)
          return () => ipcRenderer.removeListener('update-error', callback)
        },
        onDownloadProgress: (callback: any) => {
          ipcRenderer.on('download-progress', callback)
          return () => ipcRenderer.removeListener('download-progress', callback)
        },
        onUpdateDownloaded: (callback: any) => {
          ipcRenderer.on('update-downloaded', callback)
          return () => ipcRenderer.removeListener('update-downloaded', callback)
        },
        startDownload: () => ipcRenderer.send('start-download'),
        restartApp: () => ipcRenderer.send('restart-app'),
        checkForUpdates: () => ipcRenderer.invoke('check-for-updates')
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    ipcRenderer: {
      ...electronAPI.ipcRenderer,
      invoke: ipcRenderer.invoke.bind(ipcRenderer)
    }
  }
  // @ts-ignore (define in dts)
  window.api = api
}
