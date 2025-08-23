'use client'

import { useEffect, useState } from 'react'

export default function HealthStatus() {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    let mounted = true
    const ping = async () => {
      try {
        const res = await fetch('/api/health', { cache: 'no-store' })
        if (!mounted) return
        setOk(res.ok)
      } catch {
        if (!mounted) return
        setOk(false)
      }
    }
    ping()
    const id = setInterval(ping, 5000)
    return () => { mounted = false; clearInterval(id) }
  }, [])

  const color = ok === null ? 'bg-gray-300' : ok ? 'bg-green-500' : 'bg-red-500'
  const label = ok === null ? 'Checking...' : ok ? 'API: Healthy' : 'API: Down'

  return (
    <div className="flex items-center space-x-2 text-sm">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`}></span>
      <span className="text-gray-600">{label}</span>
    </div>
  )
}
