import { ipcMain, desktopCapturer, app, BrowserWindow, session } from 'electron'
import { IPC_CHANNELS } from './channels'
import path from 'path'
import fs from 'fs'
import { createHash } from 'crypto'
import { b2Storage } from '../services/b2Storage'
import { exportVideo, cancelExport, ExportData } from '../services/videoExporter'

// Ensure recordings directory exists
function getRecordingsDir(): string {
  const dir = path.join(app.getPath('home'), 'ContentKing', 'recordings')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// Ensure audio directory exists
function getAudioDir(): string {
  const dir = path.join(app.getPath('home'), 'ContentKing', 'audio')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

// TTS API configuration
const TTS_API_URL = 'https://tts.muscled.co'
const TTS_API_KEY = 'hnGSt_VC5sMqCPHjaE1_S1EBK4m-dVn1A2zhANwRd_E' // TODO: Move to settings/env

export function registerIpcHandlers(mainWindow: BrowserWindow) {
  // Setup display media handler to auto-grant screen capture permission
  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Auto-grant the first screen source
      if (sources.length > 0) {
        callback({ video: sources[0] })
      } else {
        callback({})
      }
    })
  })

  // Recording handlers
  ipcMain.handle(IPC_CHANNELS.RECORDING_START, async () => {
    // Signal renderer to begin recording via getDisplayMedia
    // The display media handler above will auto-grant permission
    return { success: true }
  })

  ipcMain.handle(IPC_CHANNELS.RECORDING_STOP, async () => {
    return { success: true }
  })

  // File handlers
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_VIDEO, async (_event, buffer: ArrayBuffer, filename: string) => {
    const recordingsDir = getRecordingsDir()
    const filePath = path.join(recordingsDir, filename)
    const nodeBuffer = Buffer.from(buffer)
    fs.writeFileSync(filePath, nodeBuffer)

    // Fire-and-forget B2 upload
    b2Storage.uploadFile(nodeBuffer, `recordings/${filename}`, 'video/webm')

    return filePath
  })

  ipcMain.handle(IPC_CHANNELS.FILE_LOAD_VIDEO, async (_event, filePath: string) => {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }
    return `content-king://video${filePath}`
  })

  ipcMain.handle(IPC_CHANNELS.FILE_GET_RECORDINGS_DIR, async () => {
    return getRecordingsDir()
  })

  // List all asset files (recordings + audio)
  ipcMain.handle(IPC_CHANNELS.FILE_LIST_ASSETS, async () => {
    const recordingsDir = getRecordingsDir()
    const audioDir = getAudioDir()

    const recordings = fs.readdirSync(recordingsDir)
      .filter(f => f.endsWith('.webm') || f.endsWith('.mp4'))
      .map(filename => {
        const filePath = path.join(recordingsDir, filename)
        const stat = fs.statSync(filePath)
        return {
          id: `asset-${filename}`,
          filename,
          filePath,
          type: 'video' as const,
          size: stat.size,
          createdAt: stat.birthtimeMs,
        }
      })

    const audioFiles = fs.readdirSync(audioDir)
      .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'))
      .map(filename => {
        const filePath = path.join(audioDir, filename)
        const stat = fs.statSync(filePath)

        // Parse WAV duration from header
        let durationSeconds: number | undefined
        if (filename.endsWith('.wav') && stat.size >= 44) {
          const buf = fs.readFileSync(filePath)
          const sampleRate = buf.readUInt32LE(24)
          const bitsPerSample = buf.readUInt16LE(34)
          const numChannels = buf.readUInt16LE(22)
          const bytesPerSample = (bitsPerSample / 8) * numChannels
          if (sampleRate > 0 && bytesPerSample > 0) {
            durationSeconds = (stat.size - 44) / (sampleRate * bytesPerSample)
          }
        }

        return {
          id: `asset-${filename}`,
          filename,
          filePath,
          type: 'audio' as const,
          size: stat.size,
          createdAt: stat.birthtimeMs,
          durationSeconds,
        }
      })

    return [...recordings, ...audioFiles].sort((a, b) => b.createdAt - a.createdAt)
  })

  // App handlers
  ipcMain.handle(IPC_CHANNELS.APP_GET_SCREEN_SOURCES, async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    })
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }))
  })

  ipcMain.handle(IPC_CHANNELS.APP_GET_PATH, async () => {
    return app.getAppPath()
  })

  // TTS handlers
  ipcMain.handle(IPC_CHANNELS.TTS_GENERATE, async (_event, text: string, voice: string, speed: number) => {
    const response = await fetch(`${TTS_API_URL}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TTS_API_KEY}`
      },
      body: JSON.stringify({ text, voice, speed, format: 'wav' })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`TTS generation failed: ${response.status} - ${errorText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioDir = getAudioDir()
    const slug = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join('-')
      .slice(0, 30)
    const filename = `tts-${slug}-${Date.now()}.wav`
    const filePath = path.join(audioDir, filename)
    const nodeBuffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, nodeBuffer)

    // Parse WAV header to get duration
    let durationSeconds = 5 // fallback
    if (nodeBuffer.length >= 44) {
      const sampleRate = nodeBuffer.readUInt32LE(24)
      const bitsPerSample = nodeBuffer.readUInt16LE(34)
      const numChannels = nodeBuffer.readUInt16LE(22)
      const bytesPerSample = (bitsPerSample / 8) * numChannels
      if (sampleRate > 0 && bytesPerSample > 0) {
        const dataSize = nodeBuffer.length - 44
        durationSeconds = dataSize / (sampleRate * bytesPerSample)
      }
    }

    // Fire-and-forget B2 upload
    b2Storage.uploadFile(nodeBuffer, `audio/${filename}`, 'audio/wav')

    return { filePath, durationSeconds }
  })

  ipcMain.handle(IPC_CHANNELS.TTS_GET_VOICES, async () => {
    const response = await fetch(`${TTS_API_URL}/voices`, {
      headers: {
        'Authorization': `Bearer ${TTS_API_KEY}`
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch voices: ${response.status}`)
    }

    const data = await response.json() as { voices?: string[] }
    const voiceList: string[] = Array.isArray(data) ? data : data.voices || []
    return voiceList.map((v: string) => ({
      id: v,
      name: v.replace(/^af_/, 'Female: ').replace(/^am_/, 'Male: ').replace(/^bf_/, 'British F: ').replace(/^bm_/, 'British M: ')
    }))
  })

  // Export handlers
  ipcMain.handle(IPC_CHANNELS.EXPORT_VIDEO, async (_event, data: ExportData) => {
    const outputPath = await exportVideo(data, (progress) => {
      mainWindow.webContents.send(IPC_CHANNELS.EXPORT_PROGRESS, progress)
    })

    // Fire-and-forget B2 upload of the exported MP4
    const buffer = fs.readFileSync(outputPath)
    const filename = path.basename(outputPath)
    b2Storage.uploadFile(Buffer.from(buffer), `exports/${filename}`, 'video/mp4')

    return outputPath
  })

  ipcMain.handle(IPC_CHANNELS.EXPORT_CANCEL, async () => {
    cancelExport()
    return { success: true }
  })

  // Project save/load handlers
  ipcMain.handle(IPC_CHANNELS.FILE_HASH, async (_event, filePath: string) => {
    const buffer = fs.readFileSync(filePath)
    const hash = createHash('sha256').update(buffer).digest('hex')
    return { sha256: hash, size: buffer.length }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    const buffer = fs.readFileSync(filePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  })

  // Cache handlers for project loading
  const getCacheDir = () => {
    const dir = path.join(app.getPath('home'), 'ContentKing', 'cache')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  ipcMain.handle(IPC_CHANNELS.CACHE_CHECK, async (_event, filename: string) => {
    const filePath = path.join(getCacheDir(), filename)
    if (fs.existsSync(filePath)) {
      return { exists: true, filePath }
    }
    return { exists: false, filePath }
  })

  ipcMain.handle(IPC_CHANNELS.CACHE_WRITE, async (_event, filename: string, buffer: ArrayBuffer) => {
    const filePath = path.join(getCacheDir(), filename)
    fs.writeFileSync(filePath, Buffer.from(buffer))
    return { filePath }
  })

  // Download a URL from main process (bypasses CORS)
  ipcMain.handle(IPC_CHANNELS.DOWNLOAD_URL, async (_event, url: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Download failed: ${res.status}`)
    const buffer = await res.arrayBuffer()
    return buffer
  })
}
