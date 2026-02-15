import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  // Recording
  startRecording: () => ipcRenderer.invoke('recording:start'),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
  onRecordingReady: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('recording:ready', handler)
    return () => ipcRenderer.removeListener('recording:ready', handler)
  },

  // File operations
  saveVideo: (buffer: ArrayBuffer, filename: string) =>
    ipcRenderer.invoke('file:save-video', buffer, filename),
  loadVideo: (filePath: string) => ipcRenderer.invoke('file:load-video', filePath),
  getRecordingsDir: () => ipcRenderer.invoke('file:get-recordings-dir'),
  listAssets: () => ipcRenderer.invoke('file:list-assets'),

  // Screen sources
  getScreenSources: () => ipcRenderer.invoke('app:get-screen-sources'),

  // App info
  getAppPath: () => ipcRenderer.invoke('app:get-path'),

  // TTS
  generateTTS: (text: string, voice: string, speed: number) =>
    ipcRenderer.invoke('tts:generate', text, voice, speed),
  getTTSVoices: () => ipcRenderer.invoke('tts:get-voices'),

  // Export
  exportVideo: (data: { clips: unknown[]; tracks: unknown[]; totalFrames: number; fps: number }) =>
    ipcRenderer.invoke('export:video', data),
  cancelExport: () => ipcRenderer.invoke('export:cancel'),

  // Project save/load
  hashFile: (filePath: string) => ipcRenderer.invoke('file:hash', filePath) as Promise<{ sha256: string; size: number }>,
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath) as Promise<ArrayBuffer>,
  cacheCheck: (filename: string) => ipcRenderer.invoke('cache:check', filename) as Promise<{ exists: boolean; filePath: string }>,
  cacheWrite: (filename: string, buffer: ArrayBuffer) => ipcRenderer.invoke('cache:write', filename, buffer) as Promise<{ filePath: string }>,
  downloadUrl: (url: string) => ipcRenderer.invoke('net:download-url', url) as Promise<ArrayBuffer>,
  onExportProgress: (callback: (progress: { percent: number; currentTime?: string; targetSize?: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: { percent: number; currentTime?: string; targetSize?: number }) => callback(progress)
    ipcRenderer.on('export:progress', handler)
    return () => ipcRenderer.removeListener('export:progress', handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
