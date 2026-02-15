import { useState, useEffect, useRef, useCallback } from 'react'
import { useVideoEditor } from '@/lib/video-editor/useVideoEditor'
import { Button } from '@/components/ui/button'
import { Play, Pause, Circle, Square, X, Maximize, Film, Music, RefreshCw, Download, ArrowUp, ArrowDown, Search, LogOut, Save, Loader2, FolderOpen } from 'lucide-react'
import type { AssetFile, ExportProgress } from '@/types/electron'
import type { AuthUser } from '@/lib/auth'
import { FPS } from '@/lib/video-editor/types'
import { Timeline } from './Timeline'
import { ScriptPanel } from './ScriptPanel'
import { useKeyboardShortcuts } from '@/lib/video-editor/useKeyboardShortcuts'
import { formatFrame } from './formatters'
import { useProjectSave } from '@/lib/useProjectSave'
import { useProjectLoad } from '@/lib/useProjectLoad'
import { OpenProjectDialog } from '@/components/OpenProjectDialog'

interface VideoStudioProps {
  user: AuthUser
  onLogout: () => void
}

export function VideoStudio({ user, onLogout }: VideoStudioProps) {
  const editor = useVideoEditor()
  const projectSave = useProjectSave()
  const projectLoad = useProjectLoad()
  const [isOpenDialogVisible, setIsOpenDialogVisible] = useState(false)
  const [topSectionHeight, setTopSectionHeight] = useState(65) // Default to 65%
  const [leftPanelWidth, setLeftPanelWidth] = useState(20) // Default to 20%
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [viewMode, setViewMode] = useState<'normal' | 'fullTab' | 'fullScreen'>('normal')
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isDraggingRef = useRef(false)
  const isDraggingHorizontalRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const videoPreviewRef = useRef<HTMLDivElement>(null)
  const [assets, setAssets] = useState<AssetFile[]>([])
  const [assetFilter, setAssetFilter] = useState<'all' | 'audio' | 'video'>('all')
  const [assetSearch, setAssetSearch] = useState('')
  const [assetSortNewest, setAssetSortNewest] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportResult, setExportResult] = useState<{ path: string } | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  // Load assets from local directories
  const loadAssets = useCallback(async () => {
    if (!window.electronAPI) return
    const files = await window.electronAPI.listAssets()
    setAssets(files)
  }, [])

  // Load assets on mount and after recording/TTS
  useEffect(() => {
    loadAssets()
  }, [loadAssets, editor.clips.length])

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // Handle vertical resizing (between preview and bottom panels)
  const handleVerticalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    
    const startY = e.clientY
    const startHeight = topSectionHeight
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return
      
      const containerHeight = containerRef.current.offsetHeight
      const deltaY = e.clientY - startY
      const deltaPercent = (deltaY / containerHeight) * 100
      const newHeight = Math.min(Math.max(20, startHeight + deltaPercent), 80) // Clamp between 20% and 80%
      
      setTopSectionHeight(newHeight)
    }
    
    const handleMouseUp = () => {
      isDraggingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
  
  // Handle horizontal resizing (between left panels and right panels)
  const handleHorizontalResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingHorizontalRef.current = true
    
    const startX = e.clientX
    const startWidth = leftPanelWidth
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingHorizontalRef.current || !containerRef.current) return
      
      const containerWidth = containerRef.current.offsetWidth
      const deltaX = e.clientX - startX
      const deltaPercent = (deltaX / containerWidth) * 100
      const newWidth = Math.min(Math.max(10, startWidth + deltaPercent), 40) // Clamp between 10% and 40%
      
      setLeftPanelWidth(newWidth)
    }
    
    const handleMouseUp = () => {
      isDraggingHorizontalRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }
  
  // Handle recording timer
  useEffect(() => {
    if (editor.isRecording) {
      setRecordingDuration(0)
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }
      setRecordingDuration(0)
    }
    
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
      }
    }
  }, [editor.isRecording])
  
  // Format recording duration
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  // Handle view mode changes
  const handleFullTab = useCallback(() => {
    setViewMode(prev => prev === 'fullTab' ? 'normal' : 'fullTab')
  }, [])
  
  const handleFullScreen = useCallback(async () => {
    // Check if we're actually in fullscreen, not just our viewMode state
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      }
      setViewMode('normal')
    } else {
      // Use the video preview container for fullscreen
      if (videoPreviewRef.current?.requestFullscreen) {
        try {
          await videoPreviewRef.current.requestFullscreen()
          setViewMode('fullScreen')
        } catch (error) {
          console.error('Failed to enter fullscreen:', error)
        }
      }
    }
  }, [])
  
  // Handle keyboard shortcuts for view modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      
      if (e.key === 'f' || e.key === 'F') {
        if (e.shiftKey) {
          // Shift+F for full screen
          e.preventDefault()
          handleFullScreen()
        } else if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          // Just F for full tab
          e.preventDefault()
          handleFullTab()
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleFullScreen, handleFullTab])
  
  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setViewMode('normal')
      }
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])
  
  // Handle video element positioning based on view mode
  useEffect(() => {
    const videoElement = editor.videoRef.current
    if (!videoElement) return
    
    const updateVideoPosition = () => {
      if (viewMode === 'normal' || viewMode === 'fullScreen') {
        // Both normal and fullScreen modes - keep video in preview container
        const previewContainer = document.getElementById('video-preview-container')
        if (previewContainer) {
          if (viewMode === 'fullScreen') {
            // In fullscreen, make video fill the entire container
            videoElement.className = `${editor.clips.length > 0 ? 'block' : 'hidden'} w-full h-full object-contain`
            videoElement.style.cssText = `
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              transform: none;
              z-index: auto;
              object-fit: contain;
            `
          } else {
            // Normal mode - centered in container
            videoElement.className = `${editor.clips.length > 0 ? 'block' : 'hidden'} max-w-full max-h-full object-contain`
            videoElement.style.cssText = `
              position: relative;
              inset: auto;
              width: auto;
              height: auto;
              transform: none;
              z-index: auto;
            `
          }
          videoElement.controls = false
          
          // Always move to preview container for these modes
          if (videoElement.parentNode !== previewContainer) {
            previewContainer.appendChild(videoElement)
          }
        }
      } else {
        // fullTab mode - Move video to document body for fixed positioning
        videoElement.className = `${editor.clips.length > 0 ? 'block' : 'hidden'} fixed object-contain`
        videoElement.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 64px;
          width: 100vw;
          height: calc(100vh - 64px);
          transform: none;
          z-index: 30;
          object-fit: contain;
        `
        videoElement.controls = false
        
        if (videoElement.parentNode !== document.body) {
          document.body.appendChild(videoElement)
        }
      }
    }
    
    // Run immediately and with small delay for DOM updates
    updateVideoPosition()
    const timer = setTimeout(updateVideoPosition, 50)
    
    return () => clearTimeout(timer)
  }, [viewMode, editor.clips.length, editor.videoRef])
  
  // Additional effect to ensure video is properly positioned when first clip is added
  useEffect(() => {
    if (editor.clips.length > 0 && viewMode === 'normal') {
      const videoElement = editor.videoRef.current
      if (videoElement) {
        const previewContainer = document.getElementById('video-preview-container')
        if (previewContainer && videoElement.parentNode !== previewContainer) {
          setTimeout(() => {
            videoElement.className = 'block max-w-full max-h-full object-contain'
            videoElement.style.cssText = `
              position: relative;
              inset: auto;
              width: auto;
              height: auto;
              transform: none;
              z-index: auto;
            `
            videoElement.controls = false
            previewContainer.appendChild(videoElement)
          }, 100)
        }
      }
    }
  }, [editor.clips.length, editor.videoRef])
  
  // Cleanup: ensure video element returns to normal container on unmount
  useEffect(() => {
    return () => {
      const videoElement = editor.videoRef.current
      if (videoElement && videoElement.parentNode === document.body) {
        const previewContainer = document.getElementById('video-preview-container')
        if (previewContainer) {
          previewContainer.appendChild(videoElement)
        }
      }
    }
  }, [])
  
  // Prevent browser back/forward navigation on horizontal swipe
  useEffect(() => {
    let timelineElement: HTMLElement | null = null
    
    const handleWheel = (e: WheelEvent) => {
      // Get timeline element
      timelineElement = timelineElement || document.querySelector('[data-timeline-scroll]')
      
      if (timelineElement && Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        // It's a horizontal swipe - always prevent browser navigation
        e.preventDefault()
        
        // Manually scroll the timeline
        timelineElement.scrollLeft += e.deltaX
      }
    }
    
    document.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])
  
  // Handle TTS audio generation
  const handleAudioGenerated = useCallback((filePath: string, durationFrames: number) => {
    editor.addAudioClip(filePath, durationFrames)
  }, [editor])

  // Handle export
  const handleExport = useCallback(async () => {
    if (!window.electronAPI || isExporting) return

    setIsExporting(true)
    setExportProgress(0)
    setExportResult(null)
    setExportError(null)

    try {
      const outputPath = await window.electronAPI.exportVideo({
        clips: editor.clips.map(c => ({
          id: c.id,
          url: c.url,
          trackIndex: c.trackIndex,
          startFrame: c.startFrame,
          durationFrames: c.durationFrames,
          sourceInFrame: c.sourceInFrame,
          sourceOutFrame: c.sourceOutFrame,
        })),
        tracks: editor.tracks.map(t => ({
          id: t.id,
          index: t.index,
          name: t.name,
          type: t.type,
          visible: t.visible,
          locked: t.locked,
          muted: t.muted,
        })),
        totalFrames: editor.totalFrames,
        fps: FPS,
      })
      setExportResult({ path: outputPath })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      if (msg !== 'Export cancelled') {
        setExportError(msg)
      }
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }, [editor.clips, editor.tracks, editor.totalFrames, isExporting])

  const handleCancelExport = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.cancelExport()
    }
  }, [])

  // Listen for export progress
  useEffect(() => {
    if (!window.electronAPI) return
    const unsubscribe = window.electronAPI.onExportProgress((progress: ExportProgress) => {
      setExportProgress(Math.round(progress.percent))
    })
    return unsubscribe
  }, [])

  // Auto-dismiss export result after 5s
  useEffect(() => {
    if (exportResult || exportError) {
      const timer = setTimeout(() => {
        setExportResult(null)
        setExportError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [exportResult, exportError])

  // Handle delete with selection clearing
  const handleDeleteClip = (clipId: string) => {
    editor.deleteClip(clipId)
    editor.setSelectedClipId(null) // Clear selection after deletion
  }
  
  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    isPlaying: editor.isPlaying,
    play: editor.play,
    pause: editor.pause,
    undo: editor.undo,
    redo: editor.redo,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    currentFrame: editor.currentFrame,
    clips: editor.clips,
    splitClip: editor.splitClip,
    trimClipLeft: editor.trimClipLeft,
    trimClipRight: editor.trimClipRight,
    seekToFrame: editor.seekToFrame,
    selectedClipId: editor.selectedClipId,
    deleteClip: handleDeleteClip
  })
  
  const handleOpenProject = useCallback(async (projectId: string) => {
    const result = await projectLoad.loadProject(projectId)
    if (result) {
      editor.loadProjectState(result.clips, result.tracks)
      projectSave.setProjectId(result.projectId)
      setIsOpenDialogVisible(false)
    }
  }, [projectLoad, editor, projectSave])

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Video element will be positioned by useEffect - start hidden */}
      <video 
        ref={editor.videoRef}
        className="hidden"
      />

      {/* Full Tab View Controls (outside preview container) */}
      {viewMode === 'fullTab' && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute top-4 right-4 flex gap-2 z-10 pointer-events-auto">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFullScreen}
              className="text-white hover:bg-gray-800"
              title="Full Screen (Shift+F)"
            >
              <Maximize className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFullTab}
              className="text-white hover:bg-gray-800"
              title="Exit Full Tab View (F)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {editor.clips.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center pointer-events-none">
              <div>
                <p className="text-lg">No clips to preview</p>
                <p className="text-sm">Press F to exit full tab view</p>
              </div>
            </div>
          )}
          
          {/* Playback controls and timeline at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90 pointer-events-auto">
            {/* Timeline seeker bar */}
            <div className="px-4 py-2">
              <div 
                className="relative h-2 bg-gray-700 rounded-full cursor-pointer hover:h-3 transition-all"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = e.clientX - rect.left
                  const percent = x / rect.width
                  const frame = Math.round(percent * editor.totalFrames)
                  editor.seekToFrame(frame, true)
                }}
              >
                {/* Progress bar */}
                <div 
                  className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                  style={{ width: `${(editor.currentFrame / Math.max(1, editor.totalFrames)) * 100}%` }}
                />
                {/* Scrubber handle */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                  style={{ left: `${(editor.currentFrame / Math.max(1, editor.totalFrames)) * 100}%`, marginLeft: '-8px' }}
                />
              </div>
            </div>
            
            {/* Controls */}
            <div className="h-12 flex items-center justify-center gap-4 pb-2">
              {!editor.isPlaying ? (
                <Button 
                  size="sm"
                  onClick={editor.play}
                  variant="ghost"
                  className="text-white hover:bg-gray-800"
                >
                  <Play className="h-5 w-5" />
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={editor.pause}
                  variant="ghost"
                  className="text-white hover:bg-gray-800"
                >
                  <Pause className="h-5 w-5" />
                </Button>
              )}
              <span className="text-sm text-gray-300 font-mono">
                {formatFrame(editor.currentFrame)} / {formatFrame(editor.totalFrames)}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Header - Fixed height - Hide in fullTab mode */}
      {viewMode !== 'fullTab' && (
        <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Content King</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Recording Controls in Header */}
          {!editor.isRecording ? (
            <Button 
              size="sm"
              onClick={editor.startRecording}
              className="bg-red-600 hover:bg-red-700"
            >
              <Circle className="h-3 w-3 mr-1" />
              Record
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-red-500 font-semibold text-sm flex items-center gap-1">
                <Circle className="h-3 w-3 fill-red-500 animate-pulse" />
                {formatRecordingTime(recordingDuration)}
              </span>
              <Button 
                size="sm"
                onClick={editor.stopRecording}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <Square className="h-3 w-3 mr-1 fill-white" />
                Stop
              </Button>
            </div>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsOpenDialogVisible(true)}
          >
            <FolderOpen className="h-3 w-3 mr-1" />Open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => projectSave.saveProject('Untitled Project', editor.clips, editor.tracks)}
            disabled={projectSave.isSaving || editor.clips.length === 0}
          >
            {projectSave.isSaving ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving...</>
            ) : (
              <><Save className="h-3 w-3 mr-1" />Save Project</>
            )}
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleExport}
            disabled={isExporting || editor.clips.length === 0}
          >
            <Download className="h-3 w-3 mr-1" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
          <div className="w-px h-6 bg-gray-700 mx-1" />
          <span className="text-xs text-gray-400">{user.name || user.email}</span>
          <Button size="sm" variant="ghost" onClick={onLogout} title="Sign out" className="h-7 w-7 p-0">
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </div>
      )}
      
      {/* Export Progress Bar */}
      {isExporting && (
        <div className="h-8 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400">Exporting</span>
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${exportProgress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 w-10 text-right">{exportProgress}%</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-xs text-red-400 hover:text-red-300"
            onClick={handleCancelExport}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Export Result/Error Messages */}
      {exportResult && (
        <div className="h-8 bg-green-900/50 border-b border-green-700 flex items-center px-4 gap-2 flex-shrink-0">
          <span className="text-xs text-green-300">Exported to: {exportResult.path}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-xs text-green-400"
            onClick={() => setExportResult(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {exportError && (
        <div className="h-8 bg-red-900/50 border-b border-red-700 flex items-center px-4 gap-2 flex-shrink-0">
          <span className="text-xs text-red-300">Export failed: {exportError}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-2 text-xs text-red-400"
            onClick={() => setExportError(null)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Save Result/Error Messages */}
      {projectSave.lastSavedAt && !projectSave.isSaving && (
        <div className="h-8 bg-green-900/50 border-b border-green-700 flex items-center px-4 gap-2 flex-shrink-0">
          <span className="text-xs text-green-300">Project saved</span>
        </div>
      )}
      {projectSave.error && (
        <div className="h-8 bg-red-900/50 border-b border-red-700 flex items-center px-4 gap-2 flex-shrink-0">
          <span className="text-xs text-red-300">Save failed: {projectSave.error}</span>
        </div>
      )}

      {/* Main 4-Panel Layout - Hide in fullTab mode */}
      {viewMode !== 'fullTab' && (
      <div className="flex-1 flex flex-col overflow-hidden" ref={containerRef}>
        {/* Top Section - Dynamic height (Script + Preview) */}
        <div className="flex" style={{ height: `${topSectionHeight}%` }}>
          {/* AI Script Panel - Dynamic width */}
          <div className="bg-gray-800 overflow-auto" style={{ width: `${leftPanelWidth}%` }}>
            <ScriptPanel onAudioGenerated={handleAudioGenerated} />
          </div>
          
          {/* Horizontal Resize Handle */}
          <div 
            className="w-1 bg-gray-700 cursor-ew-resize hover:bg-gray-600 transition-colors relative group"
            onMouseDown={handleHorizontalResizeMouseDown}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-12 bg-gray-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          
          {/* Preview Panel - Dynamic width */}
          <div className="flex-1 bg-black flex flex-col overflow-hidden" style={{ width: `${100 - leftPanelWidth}%` }}>
            {/* Video Preview Area */}
            <div ref={videoPreviewRef} className="flex-1 flex items-center justify-center relative overflow-hidden" id="video-preview-container">
              <div className={`text-gray-500 text-center ${editor.clips.length > 0 ? 'hidden' : ''}`}>
                <div className="mb-4">
                  <svg className="w-16 h-16 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-lg mb-1">Video Preview</p>
                <p className="text-sm text-gray-600">Click "Record" to begin</p>
              </div>
              
              {/* Fullscreen mode controls - rendered inside the preview container */}
              {viewMode === 'fullScreen' && (
                <>
                  {/* Exit button */}
                  <div className="absolute top-4 right-4 flex gap-2 z-10">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleFullScreen}
                      className="text-white hover:bg-gray-800 bg-gray-900 bg-opacity-50"
                      title="Exit Full Screen (Shift+F or Esc)"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Timeline and controls at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-90">
                    {/* Timeline seeker bar */}
                    <div className="px-4 py-2">
                      <div 
                        className="relative h-2 bg-gray-700 rounded-full cursor-pointer hover:h-3 transition-all"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          const x = e.clientX - rect.left
                          const percent = x / rect.width
                          const frame = Math.round(percent * editor.totalFrames)
                          editor.seekToFrame(frame, true)
                        }}
                      >
                        {/* Progress bar */}
                        <div 
                          className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                          style={{ width: `${(editor.currentFrame / Math.max(1, editor.totalFrames)) * 100}%` }}
                        />
                        {/* Scrubber handle */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg"
                          style={{ left: `${(editor.currentFrame / Math.max(1, editor.totalFrames)) * 100}%`, marginLeft: '-8px' }}
                        />
                      </div>
                    </div>
                    
                    {/* Controls */}
                    <div className="h-12 flex items-center justify-center gap-4 pb-2">
                      {!editor.isPlaying ? (
                        <Button 
                          size="sm"
                          onClick={editor.play}
                          variant="ghost"
                          className="text-white hover:bg-gray-800"
                        >
                          <Play className="h-5 w-5" />
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={editor.pause}
                          variant="ghost"
                          className="text-white hover:bg-gray-800"
                        >
                          <Pause className="h-5 w-5" />
                        </Button>
                      )}
                      <span className="text-sm text-gray-300 font-mono">
                        {formatFrame(editor.currentFrame)} / {formatFrame(editor.totalFrames)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* Playback Controls */}
            <div className="h-12 bg-gray-850 border-t border-gray-700 flex items-center justify-center gap-2">
              {!editor.isPlaying ? (
                <Button 
                  size="sm"
                  onClick={editor.play}
                  variant="ghost"
                >
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  size="sm"
                  onClick={editor.pause}
                  variant="ghost"
                >
                  <Pause className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xs text-gray-400 ml-4 font-mono" style={{ minWidth: '140px', display: 'inline-block' }}>
                {formatFrame(editor.currentFrame)} / {formatFrame(editor.totalFrames)}
              </span>
            </div>
          </div>
        </div>
        
        {/* Vertical Resize Handle */}
        <div 
          className="relative h-1 bg-gray-700 cursor-ns-resize hover:bg-gray-600 transition-colors group z-[25]"
          onMouseDown={handleVerticalResizeMouseDown}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-1 bg-gray-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        
        {/* Bottom Section - Dynamic height (Assets + Timeline) */}
        <div className="flex flex-1" style={{ height: `${100 - topSectionHeight}%` }}>
          {/* Assets Panel - Dynamic width */}
          <div className="bg-gray-800 overflow-auto" style={{ width: `${leftPanelWidth}%` }}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">Assets</h3>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={loadAssets}>
                  <RefreshCw className="w-3 h-3" />
                </Button>
              </div>
              {/* Filter pills */}
              <div className="flex gap-1 mb-3">
                {(['all', 'audio', 'video'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setAssetFilter(filter)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize transition-colors ${
                      assetFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              {/* Search + Sort row */}
              <div className="flex gap-1 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                  <input
                    type="text"
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    placeholder="Search assets..."
                    className="w-full text-xs bg-gray-900 text-gray-300 rounded pl-6 pr-2 py-1 border border-gray-700 focus:border-gray-500 focus:outline-none placeholder-gray-600"
                  />
                </div>
                <button
                  onClick={() => setAssetSortNewest((v) => !v)}
                  className="flex items-center gap-0.5 px-2 py-1 rounded text-[10px] font-medium bg-gray-700 text-gray-400 hover:bg-gray-600 transition-colors whitespace-nowrap"
                >
                  {assetSortNewest ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
                  {assetSortNewest ? 'Newest' : 'Oldest'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {assets.length === 0 && (
                  <p className="text-xs text-gray-500 text-center py-4 col-span-3">No assets yet. Record a video or generate TTS.</p>
                )}
                {(() => {
                  const filtered = assets
                    .filter((a) => assetFilter === 'all' || a.type === assetFilter)
                    .filter((a) => !assetSearch || a.filename.toLowerCase().includes(assetSearch.toLowerCase()))
                    .sort((a, b) => assetSortNewest ? b.createdAt - a.createdAt : a.createdAt - b.createdAt)
                  if (filtered.length === 0 && assets.length > 0) {
                    return <p className="text-xs text-gray-500 text-center py-4 col-span-3">No matching assets</p>
                  }
                  return filtered.map((asset) => {
                  const durationFrames = asset.durationSeconds
                    ? Math.ceil(asset.durationSeconds * FPS)
                    : 150
                  return (
                  <div
                    key={asset.id}
                    className="bg-gray-900 rounded-lg p-2 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-700 hover:ring-1 hover:ring-gray-500 transition-colors"
                    draggable={asset.type === 'audio'}
                    onDragStart={(e) => {
                      if (asset.type === 'audio') {
                        e.dataTransfer.setData('application/json', JSON.stringify({
                          filePath: asset.filePath,
                          durationFrames,
                          type: 'audio'
                        }))
                      }
                    }}
                    onClick={() => {
                      if (asset.type === 'audio') {
                        editor.addAudioClip(asset.filePath, durationFrames)
                      }
                    }}
                  >
                    {asset.type === 'video' ? (
                      <Film className="w-5 h-5 text-blue-400 mb-1" />
                    ) : (
                      <Music className="w-5 h-5 text-green-400 mb-1" />
                    )}
                    <p className="text-[10px] text-gray-300 truncate w-full">{asset.filename}</p>
                    <p className="text-[10px] text-gray-500">
                      {asset.durationSeconds
                        ? `${Math.floor(asset.durationSeconds / 60)}:${String(Math.floor(asset.durationSeconds % 60)).padStart(2, '0')}`
                        : formatSize(asset.size)}
                    </p>
                  </div>
                  )
                })
                })()}
              </div>
            </div>
          </div>
          
          {/* Horizontal Resize Handle (for bottom section) */}
          <div 
            className="w-1 bg-gray-700 cursor-ew-resize hover:bg-gray-600 transition-colors relative group"
            onMouseDown={handleHorizontalResizeMouseDown}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-1 h-12 bg-gray-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          
          {/* Timeline Panel - Dynamic width */}
          <div className="flex-1 overflow-hidden" style={{ width: `${100 - leftPanelWidth}%` }}>
            <Timeline 
              clips={editor.clips}
              tracks={editor.tracks}
              currentFrame={editor.visualFrame}  // Use throttled frame for smooth visuals
              totalFrames={editor.totalFrames}
              isPlaying={editor.isPlaying}
              onPause={editor.pause}
              onSeekToFrame={editor.seekToFrame}
              selectedClipId={editor.selectedClipId}
              selectedTrackIndex={editor.selectedTrackIndex}
              onSelectClip={editor.setSelectedClipId}
              onSelectTrack={editor.setSelectedTrackIndex}
              onMoveClip={editor.moveClip}
              onMoveClipComplete={editor.moveClipComplete}
              onMoveClipToTrack={editor.moveClipToTrack}
              onTrimClipStart={editor.trimClipStart}
              onTrimClipStartComplete={editor.trimClipStartComplete}
              onTrimClipEnd={editor.trimClipEnd}
              onTrimClipEndComplete={editor.trimClipEndComplete}
              onAddTrack={editor.addTrack}
              onToggleTrackMute={editor.toggleTrackMute}
              onDropAudioClip={(filePath, durationFrames, startFrame) => {
                editor.addAudioClipAtFrame(filePath, durationFrames, startFrame)
              }}
            />
          </div>
        </div>
      </div>
      )}

      <OpenProjectDialog
        isOpen={isOpenDialogVisible}
        onClose={() => setIsOpenDialogVisible(false)}
        onSelect={handleOpenProject}
        projects={projectLoad.projects}
        isLoading={projectLoad.isLoadingList}
        isLoadingProject={projectLoad.isLoadingProject}
        error={projectLoad.loadError}
        onRefresh={projectLoad.fetchProjects}
      />
    </div>
  )
}