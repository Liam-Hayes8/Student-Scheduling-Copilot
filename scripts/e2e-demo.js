// Simple E2E demo test hitting Next API endpoints (port 3004)
// Requires: frontend dev server (3004) and demo API (3006) running

async function main() {
  const base = 'http://localhost:3004'
  let failures = 0

  const log = (ok, label) => {
    console.log(`${ok ? '✅' : '❌'} ${label}`)
    if (!ok) failures++
  }

  try {
    // Health via proxy
    const health = await fetch(`${base}/api/health`).then(r => r.json()).catch(() => null)
    log(!!health && health.status === 'healthy', 'Health endpoint reachable')

    // Planner analyze
    const analyzeBody = { naturalLanguageInput: 'Study 7-9pm Tuesday/Thursday', userId: 'demo-user' }
    const analyzeResp = await fetch(`${base}/api/planner/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(analyzeBody)
    })
    const analyzeJson = await analyzeResp.json().catch(() => ({}))
    log(analyzeResp.ok && analyzeJson?.success, 'Planner analyze returns success')

    // Syllabus upload (demo accepts JSON)
    const uploadResp = await fetch(`${base}/api/syllabus/upload`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: 'demo.pdf', userId: 'demo-user' })
    })
    const uploadJson = await uploadResp.json().catch(() => ({}))
    log(uploadResp.ok && uploadJson?.success, 'Syllabus upload returns success (demo)')

    // Syllabus search
    const searchResp = await fetch(`${base}/api/syllabus/search?userId=demo-user&query=exam`)
    const searchJson = await searchResp.json().catch(() => ({}))
    log(searchResp.ok && typeof searchJson?.data?.count === 'number', 'Syllabus search returns results')

    // Calendar create (demo)
    const calResp = await fetch(`${base}/api/calendar/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Demo', startDateTime: new Date().toISOString(), endDateTime: new Date(Date.now()+3600000).toISOString() })
    })
    const calJson = await calResp.json().catch(() => ({}))
    log(calResp.ok && calJson?.success && calJson?.data?.id, 'Calendar create returns mock id')

  } catch (e) {
    console.error('E2E error:', e)
    failures++
  }

  console.log(`\nResult: ${failures === 0 ? 'ALL PASS' : failures + ' failure(s)'}`)
  process.exitCode = failures === 0 ? 0 : 1
}

main()
