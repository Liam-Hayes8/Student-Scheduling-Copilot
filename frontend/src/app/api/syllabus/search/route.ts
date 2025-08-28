import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
    const apiUrl = demo ? 'http://localhost:3006' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005')
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'demo-user'
    const query = searchParams.get('query') || ''
    const resp = await fetch(`${apiUrl}/api/syllabus/search?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`)
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
