import request from 'supertest'
import app from '@/index'

describe('E2E (smoke)', () => {
  test('health returns healthy', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body?.status).toBe('healthy')
  })
})
