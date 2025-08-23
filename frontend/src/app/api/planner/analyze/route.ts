import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { naturalLanguageInput } = body

    if (!naturalLanguageInput) {
      return NextResponse.json({ error: 'Missing naturalLanguageInput' }, { status: 400 })
    }

    // Connect to our simple backend server
    const apiUrl = 'http://localhost:3006'
    
    const response = await fetch(`${apiUrl}/api/planner/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        naturalLanguageInput,
        userId: 'demo-user',
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