import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { naturalLanguageInput } = body

    if (!naturalLanguageInput) {
      return NextResponse.json({ error: 'Missing naturalLanguageInput' }, { status: 400 })
    }

    const apiUrl = process.env.API_URL || 'http://localhost:3001'
    
    const response = await fetch(`${apiUrl}/api/planner/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        naturalLanguageInput,
        userId: session.user?.email || 'anonymous',
        context: {
          userPreferences: body.context?.userPreferences,
          existingEvents: body.context?.existingEvents,
        }
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Backend service unavailable' }))
      return NextResponse.json(errorData, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('API route error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}