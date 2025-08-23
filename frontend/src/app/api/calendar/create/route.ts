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

    // Real mode: require signed-in session and pass bearer token to backend API
    const session = await getServerSession(authOptions)
    const accessToken = (session as any)?.accessToken as string | undefined
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005'
    const resp = await fetch(`${apiUrl}/api/calendar/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    })
    const data = await resp.json().catch(() => ({ error: 'Upstream error' }))
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
