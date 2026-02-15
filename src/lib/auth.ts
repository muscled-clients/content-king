/**
 * Auth client for Content King Electron app.
 * Authenticates against muscled-team's Better Auth API.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3007'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface SessionResponse {
  session: { id: string; userId: string; expiresAt: string }
  user: AuthUser
}

// Store session cookies from auth responses
let sessionToken: string | null = null

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }
  return headers
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser } | { error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { error: data.message || data.error || 'Sign in failed' }
    }

    // Extract session token from set-cookie header
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) {
      const match = setCookie.match(/better-auth\.session_token=([^;]+)/)
      if (match) {
        sessionToken = match[1]
        // Persist in localStorage for app restarts
        localStorage.setItem('ck_session_token', sessionToken)
      }
    }

    const data = await res.json()
    return { user: data.user }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Network error' }
  }
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    // Try to restore session from localStorage
    if (!sessionToken) {
      sessionToken = localStorage.getItem('ck_session_token')
    }
    if (!sessionToken) return null

    const res = await fetch(`${API_BASE}/api/auth/get-session`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    })

    if (!res.ok) {
      sessionToken = null
      localStorage.removeItem('ck_session_token')
      return null
    }

    const data: SessionResponse = await res.json()
    return data.user
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/sign-out`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    })
  } catch {
    // Ignore network errors on sign out
  }
  sessionToken = null
  localStorage.removeItem('ck_session_token')
}

/**
 * Make an authenticated API call to muscled-team.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!sessionToken) {
    sessionToken = localStorage.getItem('ck_session_token')
  }

  // For FormData, don't set Content-Type (browser sets boundary automatically)
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {}

  // Always include auth token
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`
  }

  // Only set Content-Type for non-FormData requests
  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  // Merge with any caller-provided headers (but not the default Content-Type for FormData)
  const callerHeaders = options.headers as Record<string, string> | undefined
  if (callerHeaders) {
    Object.assign(headers, callerHeaders)
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
}
