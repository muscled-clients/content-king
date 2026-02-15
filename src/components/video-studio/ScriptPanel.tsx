import { useState } from 'react'
import { useTTS } from '@/lib/video-editor/useTTS'
import { Button } from '@/components/ui/button'
import { Loader2, Volume2 } from 'lucide-react'

interface ScriptPanelProps {
  onAudioGenerated: (filePath: string, durationFrames: number) => void
}

export function ScriptPanel({ onAudioGenerated }: ScriptPanelProps) {
  const [scriptText, setScriptText] = useState('')
  const tts = useTTS()

  const handleGenerate = async () => {
    const result = await tts.generateSpeech(scriptText)
    if (result) {
      onAudioGenerated(result.filePath, result.durationFrames)
    }
  }

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">AI Script</h3>
      </div>

      {/* Script textarea */}
      <textarea
        className="flex-1 w-full bg-gray-900 text-gray-200 text-sm rounded-md border border-gray-700 p-3 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500"
        placeholder="Type your script here..."
        value={scriptText}
        onChange={(e) => setScriptText(e.target.value)}
        rows={6}
      />

      {/* Voice selector */}
      <div className="mt-3">
        <label className="text-xs text-gray-400 block mb-1">Voice</label>
        <select
          className="w-full bg-gray-900 text-gray-200 text-sm rounded-md border border-gray-700 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={tts.selectedVoice}
          onChange={(e) => tts.setSelectedVoice(e.target.value)}
        >
          {tts.voices.length > 0 ? (
            tts.voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))
          ) : (
            <option value="af_heart">af_heart (default)</option>
          )}
        </select>
      </div>

      {/* Speed slider */}
      <div className="mt-3">
        <label className="text-xs text-gray-400 block mb-1">
          Speed: {tts.speed.toFixed(1)}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={tts.speed}
          onChange={(e) => tts.setSpeed(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
          <span>0.5x</span>
          <span>1.0x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Error display */}
      {tts.error && (
        <p className="text-red-400 text-xs mt-2">{tts.error}</p>
      )}

      {/* Generate button */}
      <Button
        size="sm"
        onClick={handleGenerate}
        disabled={tts.isGenerating || !scriptText.trim()}
        className="mt-3 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {tts.isGenerating ? (
          <>
            <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Volume2 className="h-3 w-3 mr-1.5" />
            Generate Voiceover
          </>
        )}
      </Button>
    </div>
  )
}
