#!/usr/bin/env node
/* Minimal e2e: Next health + planner analyze */
(async () => {
  const base = 'http://localhost:3004'
  const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

  // Health
  const healthRes = await fetch(`${base}/api/health`)
  const health = await healthRes.json().catch(() => ({}))
  console.log('Health:', healthRes.status, health)
  assert(healthRes.ok, 'Health endpoint failed')

  // Planner analyze
  const analyzeRes = await fetch(`${base}/api/planner/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naturalLanguageInput: 'Study 7-9pm Tuesday/Thursday' })
  })
  const analyze = await analyzeRes.json().catch(() => ({}))
  console.log('Analyze:', analyzeRes.status, analyze?.data?.plans?.length)
  assert(analyzeRes.ok, 'Analyze endpoint failed')
  assert(Array.isArray(analyze?.data?.plans) && analyze.data.plans.length > 0, 'No plans returned')

  console.log('E2E local: OK')
})().catch((e) => { console.error('E2E local failed:', e.message); process.exit(1) })


