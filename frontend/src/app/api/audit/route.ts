export const dynamic = 'force-static'

let AUDIT_LOG: Array<{ id: string; timestamp: string; action: string; detail?: any }> = []

export async function GET() {
  return new Response(JSON.stringify({ items: AUDIT_LOG.slice(-50).reverse() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const entry = {
      id: Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      action: body?.action ?? 'unknown',
      detail: body?.detail,
    }
    AUDIT_LOG.push(entry)
    return new Response(JSON.stringify({ success: true, entry }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
