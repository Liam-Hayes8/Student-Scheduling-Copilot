'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  // In demo mode, we don't need NextAuth
  const isDemoMode = true // Set to false when you want to enable authentication
  
  if (isDemoMode) {
    return <>{children}</>
  }

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}