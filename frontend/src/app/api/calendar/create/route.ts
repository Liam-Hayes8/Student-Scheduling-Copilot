import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Demo mode uses the demo server on 3006
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
    if (demo) {
      const resp = await fetch('http://localhost:3006/api/calendar/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await resp.json().catch(() => ({ error: 'Upstream error' }))
      return NextResponse.json(data, { status: resp.status })
    }

    // Real mode: call Google Calendar directly with the user's access token
    const session = await getServerSession(authOptions)
    const accessToken = (session as { accessToken?: string } | null)?.accessToken
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, startDateTime, endDateTime, location, attendees, timeZone } = body || {}
    if (!title || !startDateTime || !endDateTime) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const googleResp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        summary: title,
        description,
        location,
        attendees: Array.isArray(attendees) ? attendees.map((email: string) => ({ email })) : undefined,
        start: { dateTime: startDateTime, timeZone: timeZone || 'UTC' },
        end: { dateTime: endDateTime, timeZone: timeZone || 'UTC' }
      })
    })

    const googleData = await googleResp.json().catch(() => ({ error: 'Google API error' }))
    if (!googleResp.ok) {
      const message = (googleData && (googleData.error?.message || googleData.message || googleData.error_description)) || 'Google API error'
      return NextResponse.json({ error: message, details: googleData }, { status: googleResp.status })
    }
    return NextResponse.json({ data: googleData }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
