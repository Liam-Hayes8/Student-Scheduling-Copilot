import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const apiUrl = 'http://localhost:3006'

    // Accept multipart/form-data from the browser and forward metadata as JSON to demo API
    const contentType = request.headers.get('content-type') || ''
    let payload: any = {}

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('syllabus') as File | null
      payload = {
        // In demo mode we don't need the file bytes
        filename: file?.name || 'syllabus.pdf',
        size: file ? (file as any).size : 0,
        userId: form.get('userId') || 'demo-user'
      }
    } else {
      // Fallback: JSON body
      payload = await request.json().catch(() => ({}))
    }

    const resp = await fetch(`${apiUrl}/api/syllabus/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    const data = await resp.json().catch(() => ({ success: false, error: 'Bad upstream response' }))
    return NextResponse.json(data, { status: resp.status })
  } catch (e) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 })
  }
}
