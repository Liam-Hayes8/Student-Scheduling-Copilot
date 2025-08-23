import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const apiUrl = 'http://localhost:3006'
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'demo-user'
    const query = searchParams.get('query') || ''
    const resp = await fetch(`${apiUrl}/api/syllabus/search?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`)
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
