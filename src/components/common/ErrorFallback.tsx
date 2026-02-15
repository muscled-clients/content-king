import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface ErrorFallbackProps {
  error: Error
  resetError: () => void
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center h-full bg-gray-900 text-white p-8">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
        <p className="text-gray-400 mb-4 text-sm">{error.message}</p>
        <Button onClick={resetError} size="sm" className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  )
}
