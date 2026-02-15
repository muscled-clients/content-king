# Auth Toggle Instructions

Auth is currently **DISABLED** (bypassed with a fake user).

## File to modify
`src/App.tsx`

## To RE-ENABLE auth

1. Uncomment these imports:
```ts
import { LoginScreen } from '@/components/LoginScreen'
import { useAuth } from '@/lib/useAuth'
```

2. Replace `const user = FAKE_USER` with:
```ts
const { user, isLoading, error, login, logout } = useAuth()
```

3. Remove the `FAKE_USER` constant

4. Uncomment the auth gate block (loading + login screen):
```ts
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
```

5. Replace `onLogout={() => {}}` with `onLogout={logout}` in both `<HomeScreen>` and `<VideoStudio>`

## Requires
- muscled-team running (backend with Better Auth)
- `VITE_API_URL` set in `.env.local` (e.g. `http://localhost:3007`)
