import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>
        send(channel: string, ...args: any[]): void
        on(channel: string, func: (...args: any[]) => void): () => void
        onUpdateAvailable?(callback: (...args: any[]) => void): () => void
        onUpdateNotAvailable?(callback: (...args: any[]) => void): () => void
        onUpdateError?(callback: (...args: any[]) => void): () => void
        onDownloadProgress?(callback: (...args: any[]) => void): () => void
        onUpdateDownloaded?(callback: (...args: any[]) => void): () => void
        startDownload?(): void
        restartApp?(): void
        checkForUpdates?(): Promise<any>
      }
    }
    api: unknown
  }
}
