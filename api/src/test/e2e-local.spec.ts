import request from 'supertest'
import app from '@/index' // if exported; otherwise skip e2e for now

describe('E2E (smoke)', () => {
  test('health returns healthy', async () => {
    const res = await request('http://localhost:3005').get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body?.status).toBe('healthy')
  })
})


