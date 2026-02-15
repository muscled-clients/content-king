import { useState, useRef, useCallback } from 'react'
import { Clip, Track } from './types'
import { timeToFrame } from './utils'

interface UseRecordingProps {
  totalFrames: number
  selectedClipId?: string | null
  selectedTrackIndex?: number | null
  clips?: Clip[]
  tracks?: Track[]
  onClipCreated: (clip: Clip) => void
  onTotalFramesUpdate: (frames: number) => void
}

export function useRecording({
  totalFrames,
  selectedClipId,
  selectedTrackIndex,
  clips = [],
  tracks = [],
  onClipCreated,
  onTotalFramesUpdate
}: UseRecordingProps) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const chunksRef = useRef<Blob[]>([])

  // Determine target track for new recording
  const getTargetTrackIndex = useCallback((): number => {
    let targetTrackIndex = 0

    if (selectedClipId && clips.length > 0) {
      const selectedClip = clips.find(c => c.id === selectedClipId)
      if (selectedClip) {
        const track = tracks.find(t => t.index === selectedClip.trackIndex)
        if (track && track.type === 'video') {
          targetTrackIndex = selectedClip.trackIndex
        }
      }
    } else if (selectedTrackIndex !== null && selectedTrackIndex !== undefined) {
      const track = tracks.find(t => t.index === selectedTrackIndex)
      if (track && track.type === 'video') {
        targetTrackIndex = selectedTrackIndex
      } else if (track && track.type === 'audio') {
        const firstVideoTrack = tracks.find(t => t.type === 'video')
        if (firstVideoTrack) {
          targetTrackIndex = firstVideoTrack.index
        }
      }
    } else {
      const firstVideoTrack = tracks.find(t => t.type === 'video')
      if (firstVideoTrack) {
        targetTrackIndex = firstVideoTrack.index
      }
    }

    return targetTrackIndex
  }, [selectedClipId, selectedTrackIndex, clips, tracks])

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // In Electron, getDisplayMedia is auto-granted by the main process handler
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      })

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm'
      })

      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })

        // Calculate duration in frames
        const recordingSeconds = (Date.now() - recordingStartTimeRef.current) / 1000
        const durationFrames = timeToFrame(recordingSeconds)

        const targetTrackIndex = getTargetTrackIndex()

        // Check if we're in Electron and can save to disk
        if (window.electronAPI) {
          // Save to disk via IPC
          const arrayBuffer = await blob.arrayBuffer()
          const filename = `recording-${Date.now()}.webm`
          const filePath = await window.electronAPI.saveVideo(arrayBuffer, filename)

          // Use the custom protocol URL for playback
          const videoUrl = `content-king://video${filePath}`

          const newClip: Clip = {
            id: `clip-${Date.now()}`,
            url: videoUrl,
            trackIndex: targetTrackIndex,
            startFrame: totalFrames,
            durationFrames,
            originalDurationFrames: durationFrames,
            sourceInFrame: 0,
            sourceOutFrame: durationFrames
          }

          onClipCreated(newClip)
          onTotalFramesUpdate(totalFrames + durationFrames)
        } else {
          // Fallback for when running in browser dev mode without Electron
          const url = URL.createObjectURL(blob)

          const newClip: Clip = {
            id: `clip-${Date.now()}`,
            url,
            trackIndex: targetTrackIndex,
            startFrame: totalFrames,
            durationFrames,
            originalDurationFrames: durationFrames,
            sourceInFrame: 0,
            sourceOutFrame: durationFrames
          }

          onClipCreated(newClip)
          onTotalFramesUpdate(totalFrames + durationFrames)
        }

        setIsRecording(false)

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      recorder.start()
      recordingStartTimeRef.current = Date.now()
      mediaRecorderRef.current = recorder
      setIsRecording(true)

    } catch (error) {
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          // User canceled the screen selection dialog
        } else if (error.name === 'NotFoundError') {
          console.error('No screen capture source available')
        } else if (error.name === 'NotReadableError') {
          console.error('Screen capture source is not readable')
        } else {
          console.error('Screen capture error:', error.name, error.message)
        }
      } else {
        console.error('Failed to start recording:', error)
      }
      setIsRecording(false)
    }
  }, [totalFrames, getTargetTrackIndex, onClipCreated, onTotalFramesUpdate])

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  return {
    isRecording,
    startRecording,
    stopRecording
  }
}
