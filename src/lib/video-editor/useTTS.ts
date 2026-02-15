import { useState, useEffect, useCallback } from 'react'
import { FPS } from './types'

export interface TTSVoice {
  id: string
  name: string
  language?: string
}

export function useTTS() {
  const [voices, setVoices] = useState<TTSVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState('af_heart')
  const [speed, setSpeed] = useState(1.0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch voices on mount
  useEffect(() => {
    if (!window.electronAPI?.getTTSVoices) return

    window.electronAPI.getTTSVoices()
      .then((voiceList) => {
        if (Array.isArray(voiceList)) {
          setVoices(voiceList)
        }
      })
      .catch((err) => {
        console.error('Failed to fetch TTS voices:', err)
      })
  }, [])

  // Generate speech and return file path + duration in frames
  const generateSpeech = useCallback(async (text: string): Promise<{ filePath: string; durationFrames: number } | null> => {
    if (!window.electronAPI?.generateTTS) {
      setError('TTS not available (not running in Electron)')
      return null
    }

    if (!text.trim()) {
      setError('Please enter some text')
      return null
    }

    setIsGenerating(true)
    setError(null)

    try {
      const result = await window.electronAPI.generateTTS(text, selectedVoice, speed)
      const durationFrames = Math.ceil(result.durationSeconds * FPS)

      return { filePath: result.filePath, durationFrames }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS generation failed'
      setError(message)
      return null
    } finally {
      setIsGenerating(false)
    }
  }, [selectedVoice, speed])

  return {
    voices,
    selectedVoice,
    setSelectedVoice,
    speed,
    setSpeed,
    isGenerating,
    error,
    generateSpeech
  }
}

