import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
    const apiUrl = demo ? 'http://localhost:3006' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005')
    const body = await request.json()
    const resp = await fetch(`${apiUrl}/api/syllabus/import-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await resp.json()
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
