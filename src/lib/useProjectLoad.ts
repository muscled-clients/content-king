import { useState, useCallback } from 'react'
import { apiFetch } from './auth'
import type { Clip, Track } from './video-editor/types'

interface ProjectListItem {
  id: string
  name: string
  owner_id: string
  locked_by: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
  owner_name: string
  locker_name: string | null
}

interface ProjectAsset {
  id: string
  sha256: string
  filename: string
  type: string
  sizeBytes: number
  durationSeconds: number | null
  downloadUrl: string
}

interface ProjectData {
  version: number
  timeline: {
    tracks: Track[]
    clips: Array<{
      id: string
      assetSha256: string | null
      trackIndex: number
      startFrame: number
      durationFrames: number
      originalDurationFrames?: number
      sourceInFrame?: number
      sourceOutFrame?: number
    }>
  }
  assets: Record<string, { filename: string; type: string; size: number }>
}

/**
 * Determine file extension from filename.
 */
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot >= 0 ? filename.slice(dot) : ''
}

export function useProjectLoad() {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [isLoadingList, setIsLoadingList] = useState(false)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setIsLoadingList(true)
    setLoadError(null)

    try {
      const res = await apiFetch('/api/content-king/projects')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to list projects')
      }

      const data = await res.json()
      setProjects(data.projects)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to list projects')
    } finally {
      setIsLoadingList(false)
    }
  }, [])

  const loadProject = useCallback(async (
    projectId: string
  ): Promise<{ clips: Clip[]; tracks: Track[]; projectId: string; projectName: string } | null> => {
    if (!window.electronAPI) return null

    setIsLoadingProject(true)
    setLoadError(null)

    try {
      // Step 1: Fetch project metadata + signed URLs
      const res = await apiFetch(`/api/content-king/projects/${projectId}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load project')
      }

      const { project, projectData, assets } = await res.json() as {
        project: { id: string; name: string }
        projectData: ProjectData
        assets: ProjectAsset[]
      }

      if (!projectData) throw new Error('Project data is missing')

      // Step 2: Download missing assets to local cache via Electron (bypasses CORS)
      const assetPathMap: Record<string, string> = {} // sha256 → local file path

      for (const asset of assets) {
        const ext = getExtension(asset.filename)
        const cacheFilename = `${asset.sha256}${ext}`

        // Check if already cached
        const cacheResult = await window.electronAPI.cacheCheck(cacheFilename)

        if (cacheResult.exists) {
          assetPathMap[asset.sha256] = cacheResult.filePath
        } else {
          // Download from B2 via Electron main process (no CORS)
          const buffer = await window.electronAPI.downloadUrl(asset.downloadUrl)
          const { filePath } = await window.electronAPI.cacheWrite(cacheFilename, buffer)
          assetPathMap[asset.sha256] = filePath
        }
      }

      // Step 4: Reconstruct clips with local file paths
      const clips: Clip[] = projectData.timeline.clips.map(clipData => ({
        id: clipData.id,
        url: clipData.assetSha256 && assetPathMap[clipData.assetSha256]
          ? `content-king://video${assetPathMap[clipData.assetSha256]}`
          : '',
        trackIndex: clipData.trackIndex,
        startFrame: clipData.startFrame,
        durationFrames: clipData.durationFrames,
        originalDurationFrames: clipData.originalDurationFrames,
        sourceInFrame: clipData.sourceInFrame,
        sourceOutFrame: clipData.sourceOutFrame,
      }))

      return {
        clips,
        tracks: projectData.timeline.tracks,
        projectId: project.id,
        projectName: project.name,
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load project')
      return null
    } finally {
      setIsLoadingProject(false)
    }
  }, [])

  const unlockProject = useCallback(async (projectId: string) => {
    try {
      await apiFetch(`/api/content-king/projects/${projectId}/unlock`, { method: 'POST' })
    } catch {
      // Ignore unlock errors
    }
  }, [])

  return {
    projects,
    isLoadingList,
    isLoadingProject,
    loadError,
    fetchProjects,
    loadProject,
    unlockProject,
  }
}
