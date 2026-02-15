import { useState, useCallback } from 'react'
import { VideoStudio } from '@/components/video-studio/VideoStudio'
// import { LoginScreen } from '@/components/LoginScreen'
import { HomeScreen } from '@/components/HomeScreen'
// import { useAuth } from '@/lib/useAuth'
import { useProjectLoad } from '@/lib/useProjectLoad'

interface ActiveProject {
  id: string
  name: string
}

// TODO: Re-enable auth when ready — uncomment useAuth, LoginScreen, and the auth gate below
const FAKE_USER = { id: 'dev', name: 'Dev User', email: 'dev@local', role: 'developer' }

export default function App() {
  // const { user, isLoading, error, login, logout } = useAuth()
  const user = FAKE_USER
  const projectLoad = useProjectLoad()
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null)

  const handleNewProject = useCallback(() => {
    setActiveProject({ id: '', name: 'Untitled Project' })
  }, [])

  const handleOpenProject = useCallback(async (projectId: string) => {
    const result = await projectLoad.loadProject(projectId)
    if (result) {
      setActiveProject({ id: result.projectId, name: result.projectName })
    }
    return result
  }, [projectLoad])

  const handleGoHome = useCallback(() => {
    if (activeProject?.id) {
      projectLoad.unlockProject(activeProject.id)
    }
    setActiveProject(null)
  }, [activeProject, projectLoad])

  // Auth gate — disabled for now
  // if (isLoading) {
  //   return (
  //     <div className="h-screen flex items-center justify-center bg-gray-900">
  //       <div className="text-gray-400 text-sm">Loading...</div>
  //     </div>
  //   )
  // }
  // if (!user) {
  //   return <LoginScreen onLogin={login} error={error} />
  // }

  if (!activeProject) {
    return (
      <HomeScreen
        user={user}
        onLogout={() => {}}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        projects={projectLoad.projects}
        isLoadingList={projectLoad.isLoadingList}
        isLoadingProject={projectLoad.isLoadingProject}
        error={projectLoad.loadError}
        onRefresh={projectLoad.fetchProjects}
        onDelete={projectLoad.deleteProject}
      />
    )
  }

  return (
    <div className="fixed inset-0">
      <VideoStudio
        user={user}
        onLogout={() => {}}
        onGoHome={handleGoHome}
        initialProjectId={activeProject.id || null}
        initialProjectName={activeProject.name}
        loadedProjectData={projectLoad.lastLoadedData}
      />
    </div>
  )
}
