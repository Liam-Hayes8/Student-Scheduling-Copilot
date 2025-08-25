import { NextResponse } from 'next/server'

export async function GET() {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
  return NextResponse.json({
    status: 'healthy',
    mode: demo ? 'demo' : 'real',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0'
  })
}


