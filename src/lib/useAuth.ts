import { useState, useEffect, useCallback } from 'react'
import { signIn, signOut, getSession, type AuthUser } from './auth'

interface UseAuthReturn {
  user: AuthUser | null
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check for existing session on mount
  useEffect(() => {
    getSession()
      .then((u) => setUser(u))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null)
    setIsLoading(true)

    const result = await signIn(email, password)

    if ('error' in result) {
      setError(result.error)
      setIsLoading(false)
      return false
    }

    setUser(result.user)
    setIsLoading(false)
    return true
  }, [])

  const logout = useCallback(async () => {
    await signOut()
    setUser(null)
  }, [])

  return { user, isLoading, error, login, logout }
}
