'use client'

import { useEffect, useState } from 'react'

interface AuditEntry {
  id: string
  timestamp: string
  action: string
  detail?: unknown
}

export default function AuditPanel() {
  const [items, setItems] = useState<AuditEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    try {
      setError(null)
      const res = await fetch('/api/audit')
      if (!res.ok) throw new Error('Failed to load audit log')
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setError('Failed to load audit log')
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">Recent activity</h3>
        <button onClick={load} className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200">Refresh</button>
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      <div className="text-sm text-gray-700 space-y-2 max-h-60 overflow-auto">
        {items.length === 0 ? (
          <div className="text-gray-500">No activity yet.</div>
        ) : (
          items.map((e) => (
            <div key={e.id} className="border border-gray-200 rounded p-2">
              <div className="text-gray-900 font-medium">{e.action}</div>
              <div className="text-gray-500 text-xs">{new Date(e.timestamp).toLocaleString()}</div>
              {e.detail ? (
                <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto">{JSON.stringify(e.detail, null, 2)}</pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  )}


