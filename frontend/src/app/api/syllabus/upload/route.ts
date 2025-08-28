import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
    const apiUrl = demo ? 'http://localhost:3006' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005')

    // Accept multipart/form-data from the browser and forward metadata as JSON to demo API
    const contentType = request.headers.get('content-type') || ''
    let payload: Record<string, unknown> = {}

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('syllabus') as File | null

      if (demo) {
        payload = {
          filename: file?.name || 'syllabus.pdf',
          size: file ? (file as File).size : 0,
          userId: form.get('userId') || 'demo-user'
        }
        const resp = await fetch(`${apiUrl}/api/syllabus/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await resp.json().catch(() => ({ success: false, error: 'Bad upstream response' }))
        return NextResponse.json(data, { status: resp.status })
      } else {
        const fd = new FormData()
        if (file) fd.append('syllabus', file, file.name)
        fd.append('userId', (form.get('userId') || 'demo-user') as string)
        const resp = await fetch(`${apiUrl}/api/syllabus/upload`, {
          method: 'POST',
          body: fd
        })
        const data = await resp.json().catch(() => ({ success: false, error: 'Bad upstream response' }))
        return NextResponse.json(data, { status: resp.status })
      }
    } else {
      // Fallback: JSON body
      payload = await request.json().catch(() => ({}))
      const resp = await fetch(`${apiUrl}/api/syllabus/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await resp.json().catch(() => ({ success: false, error: 'Bad upstream response' }))
      return NextResponse.json(data, { status: resp.status })
    }
    
  } catch {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
