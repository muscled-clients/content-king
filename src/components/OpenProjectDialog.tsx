import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, FolderOpen, Loader2, Lock } from 'lucide-react'

interface Project {
  id: string
  name: string
  updated_at: string
  locked_by: string | null
  locker_name: string | null
}

interface OpenProjectDialogProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: string) => void
  projects: Project[]
  isLoading: boolean
  isLoadingProject: boolean
  error: string | null
  onRefresh: () => void
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function OpenProjectDialog({
  isOpen,
  onClose,
  onSelect,
  projects,
  isLoading,
  isLoadingProject,
  error,
  onRefresh,
}: OpenProjectDialogProps) {
  // Fetch on open
  useEffect(() => {
    if (isOpen) onRefresh()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4 shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-white">Open Project</h2>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center py-4">{error}</p>
          )}

          {!isLoading && projects.length === 0 && !error && (
            <p className="text-xs text-gray-500 text-center py-8">No saved projects yet</p>
          )}

          {!isLoading && projects.length > 0 && (
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => !isLoadingProject && onSelect(project.id)}
                  disabled={isLoadingProject}
                  className="w-full text-left px-3 py-2.5 rounded-md bg-gray-900 hover:bg-gray-700 transition-colors border border-gray-700 hover:border-gray-600 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium truncate">{project.name}</span>
                    {project.locked_by && (
                      <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                        <Lock className="h-3 w-3" />
                        {project.locker_name}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Last saved {formatDate(project.updated_at)}
                  </p>
                </button>
              ))}
            </div>
          )}

          {isLoadingProject && (
            <div className="flex items-center justify-center gap-2 py-4 mt-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-xs text-gray-400">Loading project & downloading assets...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
