import { VideoStudio } from '@/components/video-studio/VideoStudio'
import { LoginScreen } from '@/components/LoginScreen'
import { useAuth } from '@/lib/useAuth'

export default function App() {
  const { user, isLoading, error, login, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400 text-sm">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen onLogin={login} error={error} />
  }

  return (
    <div className="fixed inset-0">
      <VideoStudio user={user} onLogout={logout} />
    </div>
  )
}
