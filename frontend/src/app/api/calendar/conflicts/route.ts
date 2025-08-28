import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  const accessToken = (session as { accessToken?: string } | null)?.accessToken
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { timeMin, timeMax, items } = await request.json()
  if (!timeMin || !timeMax) {
    return NextResponse.json({ error: 'timeMin and timeMax are required' }, { status: 400 })
  }
  const body = {
    timeMin,
    timeMax,
    items: items && Array.isArray(items) ? items : [{ id: 'primary' }],
  }
  const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(body)
  })
  const data = await resp.json().catch(() => ({ error: 'Google API error' }))
  return NextResponse.json(data, { status: resp.status })
}


