import ffmpeg from 'fluent-ffmpeg'
import ffmpegStatic from 'ffmpeg-static'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

// Set ffmpeg binary path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic)
}

export interface ExportClip {
  id: string
  url: string
  trackIndex: number
  startFrame: number
  durationFrames: number
  sourceInFrame?: number
  sourceOutFrame?: number
}

export interface ExportTrack {
  id: string
  index: number
  name: string
  type: 'video' | 'audio'
  visible: boolean
  locked: boolean
  muted?: boolean
}

export interface ExportData {
  clips: ExportClip[]
  tracks: ExportTrack[]
  totalFrames: number
  fps: number
}

export interface ExportProgress {
  percent: number
  currentTime?: string
  targetSize?: number
}

// Extract local file path from content-king://video{path} URLs or return as-is
function extractFilePath(url: string): string {
  const prefix = 'content-king://video'
  if (url.startsWith(prefix)) {
    return url.slice(prefix.length)
  }
  return url
}

function getExportsDir(): string {
  const dir = path.join(app.getPath('home'), 'ContentKing', 'exports')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

let activeProcess: ReturnType<typeof ffmpeg> | null = null

export function cancelExport(): void {
  if (activeProcess) {
    activeProcess.kill('SIGKILL')
    activeProcess = null
  }
}

export async function exportVideo(
  data: ExportData,
  onProgress: (progress: ExportProgress) => void
): Promise<string> {
  const { clips, tracks, totalFrames, fps } = data
  const outputDir = getExportsDir()
  const outputPath = path.join(outputDir, `export-${Date.now()}.mp4`)
  const totalDuration = totalFrames / fps

  // Separate video and audio clips
  const videoClips = clips
    .filter(c => {
      const track = tracks.find(t => t.index === c.trackIndex)
      return track?.type === 'video'
    })
    .sort((a, b) => a.startFrame - b.startFrame)

  const audioClips = clips
    .filter(c => {
      const track = tracks.find(t => t.index === c.trackIndex)
      return track?.type === 'audio' && !track.muted
    })
    .sort((a, b) => a.startFrame - b.startFrame)

  if (videoClips.length === 0 && audioClips.length === 0) {
    throw new Error('No clips to export')
  }

  return new Promise((resolve, reject) => {
    // Build the FFmpeg command with complex filter
    const command = ffmpeg()
    activeProcess = command

    // Track input indices
    let inputIndex = 0
    const videoInputMap: { clip: ExportClip; inputIdx: number }[] = []
    const audioInputMap: { clip: ExportClip; inputIdx: number }[] = []

    // Add video inputs
    for (const clip of videoClips) {
      const filePath = extractFilePath(clip.url)
      command.input(filePath)
      videoInputMap.push({ clip, inputIdx: inputIndex })
      inputIndex++
    }

    // Add audio inputs
    for (const clip of audioClips) {
      const filePath = extractFilePath(clip.url)
      command.input(filePath)
      audioInputMap.push({ clip, inputIdx: inputIndex })
      inputIndex++
    }

    // Build complex filter graph
    const filterParts: string[] = []
    const videoSegmentLabels: string[] = []
    const audioSegmentLabels: string[] = []

    // Process video clips - create trimmed & positioned segments
    if (videoClips.length > 0) {
      // Create a black background for the full duration
      // We'll overlay each video clip onto it
      filterParts.push(
        `color=c=black:s=1920x1080:d=${totalDuration}:r=${fps}[base]`
      )
      filterParts.push(
        `aevalsrc=0:d=${totalDuration}[silence]`
      )

      let overlayLabel = 'base'

      for (let i = 0; i < videoInputMap.length; i++) {
        const { clip, inputIdx } = videoInputMap[i]
        const sourceIn = (clip.sourceInFrame ?? 0) / fps
        const sourceOut = (clip.sourceOutFrame ?? clip.durationFrames) / fps
        const startTime = clip.startFrame / fps
        const clipDuration = clip.durationFrames / fps

        // Trim the source video
        filterParts.push(
          `[${inputIdx}:v]trim=start=${sourceIn}:end=${sourceOut},setpts=PTS-STARTPTS,` +
          `scale=1920:1080:force_original_aspect_ratio=decrease,` +
          `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black[v${i}]`
        )

        // Overlay onto the base at the correct timeline position
        const nextLabel = i === videoInputMap.length - 1 ? 'vout' : `tmp${i}`
        filterParts.push(
          `[${overlayLabel}][v${i}]overlay=0:0:enable='between(t,${startTime},${startTime + clipDuration})'[${nextLabel}]`
        )
        overlayLabel = nextLabel
      }
    } else {
      // No video clips - just create black frames
      filterParts.push(
        `color=c=black:s=1920x1080:d=${totalDuration}:r=${fps}[vout]`
      )
      filterParts.push(
        `aevalsrc=0:d=${totalDuration}[silence]`
      )
    }

    // Process audio clips
    if (audioClips.length > 0) {
      for (let i = 0; i < audioInputMap.length; i++) {
        const { clip, inputIdx } = audioInputMap[i]
        const sourceIn = (clip.sourceInFrame ?? 0) / fps
        const sourceOut = (clip.sourceOutFrame ?? clip.durationFrames) / fps
        const delayMs = Math.round((clip.startFrame / fps) * 1000)

        // Trim and delay the audio
        filterParts.push(
          `[${inputIdx}:a]atrim=start=${sourceIn}:end=${sourceOut},asetpts=PTS-STARTPTS,` +
          `adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDuration}[a${i}]`
        )
        audioSegmentLabels.push(`[a${i}]`)
      }

      // Mix all audio together with the silence base
      if (audioSegmentLabels.length === 1) {
        filterParts.push(
          `[silence]${audioSegmentLabels[0]}amix=inputs=2:duration=first:dropout_transition=0[aout]`
        )
      } else {
        const allAudioInputs = `[silence]${audioSegmentLabels.join('')}`
        filterParts.push(
          `${allAudioInputs}amix=inputs=${audioSegmentLabels.length + 1}:duration=first:dropout_transition=0[aout]`
        )
      }
    } else {
      // No audio clips - use silence
      filterParts.push(
        `[silence]acopy[aout]`
      )
    }

    const filterGraph = filterParts.join(';')

    command
      .complexFilter(filterGraph, ['vout', 'aout'])
      .outputOptions([
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-r', String(fps),
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-t', String(totalDuration),
      ])
      .output(outputPath)
      .on('progress', (progress: { percent?: number; timemark?: string; targetSize?: number }) => {
        onProgress({
          percent: progress.percent ?? 0,
          currentTime: progress.timemark,
          targetSize: progress.targetSize,
        })
      })
      .on('end', () => {
        activeProcess = null
        resolve(outputPath)
      })
      .on('error', (err: Error) => {
        activeProcess = null
        // Don't reject on intentional kill
        if (err.message?.includes('SIGKILL')) {
          reject(new Error('Export cancelled'))
        } else {
          reject(err)
        }
      })
      .run()
  })
}
