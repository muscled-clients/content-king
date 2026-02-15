import { useState, useCallback } from 'react'
import { apiFetch } from './auth'
import type { Clip, Track } from './video-editor/types'

interface SaveState {
  isSaving: boolean
  lastSavedAt: string | null
  projectId: string | null
  error: string | null
}

/**
 * Extract the local file path from a clip's content-king:// URL.
 */
function clipToFilePath(clip: Clip): string | null {
  if (clip.url.startsWith('content-king://video')) {
    return clip.url.replace('content-king://video', '')
  }
  return null
}

/**
 * Get the file extension's mime type.
 */
function getMimeType(filePath: string): string {
  if (filePath.endsWith('.webm')) return 'video/webm'
  if (filePath.endsWith('.mp4')) return 'video/mp4'
  if (filePath.endsWith('.wav')) return 'audio/wav'
  if (filePath.endsWith('.mp3')) return 'audio/mpeg'
  return 'application/octet-stream'
}

/**
 * Determine asset type from file path.
 */
function getAssetType(filePath: string): 'audio' | 'video' {
  if (filePath.endsWith('.wav') || filePath.endsWith('.mp3')) return 'audio'
  return 'video'
}

export function useProjectSave() {
  const [state, setState] = useState<SaveState>({
    isSaving: false,
    lastSavedAt: null,
    projectId: null,
    error: null,
  })

  const saveProject = useCallback(async (
    projectName: string,
    clips: Clip[],
    tracks: Track[],
  ) => {
    if (!window.electronAPI) return

    setState(prev => ({ ...prev, isSaving: true, error: null }))

    try {
      // Step 1: Collect unique file paths from clips
      const filePathSet = new Set<string>()
      for (const clip of clips) {
        const fp = clipToFilePath(clip)
        if (fp) filePathSet.add(fp)
      }
      const filePaths = Array.from(filePathSet)

      // Step 2: Hash all local files
      const fileHashes: Record<string, { sha256: string; size: number; filePath: string }> = {}
      for (const fp of filePaths) {
        const { sha256, size } = await window.electronAPI.hashFile(fp)
        fileHashes[fp] = { sha256, size, filePath: fp }
      }

      // Step 3: Build asset hash list
      const assetHashes = filePaths.map(fp => {
        const h = fileHashes[fp]
        const filename = fp.split('/').pop() || 'unknown'
        return {
          sha256: h.sha256,
          filename,
          type: getAssetType(fp),
          size: h.size,
        }
      })

      // Step 4: Build project data (clips reference assets by sha256)
      const projectData = {
        version: 1,
        timeline: {
          tracks,
          clips: clips.map(clip => {
            const fp = clipToFilePath(clip)
            return {
              id: clip.id,
              assetSha256: fp ? fileHashes[fp]?.sha256 : null,
              trackIndex: clip.trackIndex,
              startFrame: clip.startFrame,
              durationFrames: clip.durationFrames,
              originalDurationFrames: clip.originalDurationFrames,
              sourceInFrame: clip.sourceInFrame,
              sourceOutFrame: clip.sourceOutFrame,
            }
          }),
        },
        assets: Object.fromEntries(
          assetHashes.map(a => [a.sha256, { filename: a.filename, type: a.type, size: a.size }])
        ),
      }

      // Step 5: Save project (returns which assets need uploading)
      const saveRes = await apiFetch('/api/content-king/projects', {
        method: 'POST',
        body: JSON.stringify({
          projectId: state.projectId,
          name: projectName,
          projectData,
          assetHashes,
        }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.json()
        throw new Error(err.error || 'Failed to save project')
      }

      const { projectId, assetsToUpload } = await saveRes.json()

      // Step 6: Upload any missing assets
      for (const sha256 of assetsToUpload) {
        const entry = Object.values(fileHashes).find(h => h.sha256 === sha256)
        if (!entry) continue

        const fileBuffer = await window.electronAPI.readFile(entry.filePath)
        const filename = entry.filePath.split('/').pop() || 'unknown'
        const mimeType = getMimeType(entry.filePath)

        const formData = new FormData()
        formData.append('file', new Blob([fileBuffer], { type: mimeType }), filename)
        formData.append('projectId', projectId)
        formData.append('sha256', sha256)
        formData.append('filename', filename)
        formData.append('type', getAssetType(entry.filePath))

        const uploadRes = await apiFetch('/api/content-king/assets/upload', {
          method: 'POST',
          body: formData,
          headers: {}, // Let browser set Content-Type for FormData
        })

        if (!uploadRes.ok) {
          const err = await uploadRes.json()
          throw new Error(`Failed to upload asset ${filename}: ${err.error}`)
        }
      }

      setState({
        isSaving: false,
        lastSavedAt: new Date().toISOString(),
        projectId,
        error: null,
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        isSaving: false,
        error: err instanceof Error ? err.message : 'Save failed',
      }))
    }
  }, [state.projectId])

  return {
    ...state,
    saveProject,
    setProjectId: (id: string | null) => setState(prev => ({ ...prev, projectId: id })),
  }
}
