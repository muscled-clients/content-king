export interface ElectronAPI {
  // Recording
  startRecording: () => Promise<{ success: boolean }>
  stopRecording: () => Promise<{ success: boolean }>
  onRecordingReady: (callback: (filePath: string) => void) => () => void

  // File operations
  saveVideo: (buffer: ArrayBuffer, filename: string) => Promise<string>
  loadVideo: (filePath: string) => Promise<string>
  getRecordingsDir: () => Promise<string>
  listAssets: () => Promise<AssetFile[]>

  // Screen sources
  getScreenSources: () => Promise<
    Array<{
      id: string
      name: string
      thumbnail: string
    }>
  >

  // App info
  getAppPath: () => Promise<string>

  // TTS
  generateTTS: (text: string, voice: string, speed: number) => Promise<{ filePath: string; durationSeconds: number }>
  getTTSVoices: () => Promise<TTSVoice[]>

  // Export
  exportVideo: (data: ExportData) => Promise<string>
  cancelExport: () => Promise<{ success: boolean }>
  onExportProgress: (callback: (progress: ExportProgress) => void) => () => void

  // Project save/load
  hashFile: (filePath: string) => Promise<{ sha256: string; size: number }>
  readFile: (filePath: string) => Promise<ArrayBuffer>
  cacheCheck: (filename: string) => Promise<{ exists: boolean; filePath: string }>
  cacheWrite: (filename: string, buffer: ArrayBuffer) => Promise<{ filePath: string }>
  downloadUrl: (url: string) => Promise<ArrayBuffer>
}

export interface AssetFile {
  id: string
  filename: string
  filePath: string
  type: 'video' | 'audio'
  size: number
  createdAt: number
  durationSeconds?: number
}

export interface TTSVoice {
  id: string
  name: string
  language?: string
}

export interface ExportData {
  clips: Array<{
    id: string
    url: string
    trackIndex: number
    startFrame: number
    durationFrames: number
    sourceInFrame?: number
    sourceOutFrame?: number
  }>
  tracks: Array<{
    id: string
    index: number
    name: string
    type: 'video' | 'audio'
    visible: boolean
    locked: boolean
    muted?: boolean
  }>
  totalFrames: number
  fps: number
}

export interface ExportProgress {
  percent: number
  currentTime?: string
  targetSize?: number
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
