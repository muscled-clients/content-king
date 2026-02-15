import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, FolderOpen, Trash2, Loader2, LogOut, Lock, Film } from 'lucide-react'
import type { AuthUser } from '@/lib/auth'

interface Project {
  id: string
  name: string
  updated_at: string
  locked_by: string | null
  locker_name: string | null
}

interface HomeScreenProps {
  user: AuthUser
  onLogout: () => void
  onNewProject: () => void
  onOpenProject: (projectId: string) => void
  projects: Project[]
  isLoadingList: boolean
  isLoadingProject: boolean
  error: string | null
  onRefresh: () => void
  onDelete: (projectId: string) => Promise<boolean>
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function HomeScreen({
  user,
  onLogout,
  onNewProject,
  onOpenProject,
  projects,
  isLoadingList,
  isLoadingProject,
  error,
  onRefresh,
  onDelete,
}: HomeScreenProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    onRefresh()
  }, [])

  const handleDelete = async (projectId: string) => {
    setIsDeleting(true)
    await onDelete(projectId)
    setIsDeleting(false)
    setDeleteConfirmId(null)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between pr-6 pl-20 py-4 border-b border-gray-800" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <Film className="h-5 w-5 text-blue-400" />
          <span className="text-sm font-semibold">Content King</span>
        </div>
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="text-xs text-gray-400">{user.name || user.email}</span>
          <Button size="sm" variant="ghost" onClick={onLogout} title="Sign out" className="h-7 w-7 p-0">
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-10">
          {/* New Project */}
          <Button
            onClick={onNewProject}
            className="w-full mb-8 h-12 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>

          {/* Recent Projects */}
          <div className="mb-4">
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent Projects</h2>
          </div>

          {isLoadingList && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-xs text-red-400 mb-3">{error}</p>
              <Button size="sm" variant="ghost" onClick={onRefresh} className="text-xs">
                Try again
              </Button>
            </div>
          )}

          {!isLoadingList && projects.length === 0 && !error && (
            <div className="text-center py-16">
              <FolderOpen className="h-8 w-8 text-gray-700 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No projects yet</p>
              <p className="text-xs text-gray-600 mt-1">Create your first project to get started</p>
            </div>
          )}

          {!isLoadingList && projects.length > 0 && (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <button
                    onClick={() => !isLoadingProject && onOpenProject(project.id)}
                    disabled={isLoadingProject}
                    className="flex-1 text-left min-w-0 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium truncate">{project.name}</span>
                      {project.locked_by && (
                        <span className="flex items-center gap-1 text-[10px] text-yellow-400 shrink-0">
                          <Lock className="h-3 w-3" />
                          {project.locker_name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{timeAgo(project.updated_at)}</p>
                  </button>

                  {/* Delete button */}
                  {deleteConfirmId === project.id ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(project.id)}
                        disabled={isDeleting}
                        className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 text-xs"
                      >
                        {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirmId(null)}
                        className="h-7 px-2 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteConfirmId(project.id)}
                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isLoadingProject && (
            <div className="flex items-center justify-center gap-2 py-6 mt-4">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-xs text-gray-400">Loading project & downloading assets...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
