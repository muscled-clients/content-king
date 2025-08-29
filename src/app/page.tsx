"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  
  useEffect(() => {
    router.push('/studio')
  }, [router])
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white">Redirecting to video editor...</div>
    </div>
  )
}