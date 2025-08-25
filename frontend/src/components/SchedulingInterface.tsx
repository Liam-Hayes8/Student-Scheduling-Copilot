'use client'

import { useState } from 'react'
import AuditPanel from '@/components/AuditPanel'
import { PaperAirplaneIcon, SparklesIcon, CalendarIcon, ClockIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'

interface EventPlan {
  id: string
  title: string
  description?: string
  startDateTime: string
  endDateTime: string
  location?: string
  attendees?: string[]
  confidence: number
  explanation: string
}

interface SchedulingResponse {
  success: boolean
  data: {
    plans: EventPlan[]
    originalInput: string
    timestamp: string
  }
}

export default function SchedulingInterface() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<SchedulingResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [editedPlans, setEditedPlans] = useState<EventPlan[]>([])
  const [checkingConflictsFor, setCheckingConflictsFor] = useState<string | null>(null)
  const [planConflicts, setPlanConflicts] = useState<Record<string, { busy: { start: string, end: string }[] }>>({})
  const [planSuggestions, setPlanSuggestions] = useState<Record<string, { start: string, end: string }[]>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    setIsLoading(true)
    setError(null)
    setSuccessBanner(null)

    try {
      const res = await fetch('/api/planner/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          naturalLanguageInput: input,
          userId: 'temp-user-id'
        })
      })

      if (!res.ok) {
        throw new Error('Failed to analyze scheduling request')
      }

      const data: SchedulingResponse = await res.json()
      setResponse(data)
      setEditedPlans(data.data.plans) // Initialize edited plans with original plans
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const startEditing = (planId: string) => {
    setEditingPlan(planId)
  }

  const saveEdit = (planId: string) => {
    setEditingPlan(null)
  }

  const cancelEdit = () => {
    setEditingPlan(null)
    if (response) {
      setEditedPlans(response.data.plans)
    }
  }

  const updatePlanDateTime = (planId: string, field: 'startDateTime' | 'endDateTime', value: string) => {
    setEditedPlans(prev => prev.map(plan => 
      plan.id === planId ? { ...plan, [field]: value } : plan
    ))
  }

  const updatePlanTitle = (planId: string, value: string) => {
    setEditedPlans(prev => prev.map(plan => 
      plan.id === planId ? { ...plan, title: value } : plan
    ))
  }

  const intervalsOverlap = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
    return aStart < bEnd && bStart < aEnd
  }

  const computeSuggestions = (plan: EventPlan, busy: { start: string, end: string }[]) => {
    const suggestions: { start: string, end: string }[] = []
    const originalStart = new Date(plan.startDateTime)
    const originalEnd = new Date(plan.endDateTime)
    const durationMs = originalEnd.getTime() - originalStart.getTime()

    // Create a search window: from start-of-day to +2 days
    const windowStart = new Date(originalStart)
    windowStart.setHours(0, 0, 0, 0)
    const windowEnd = new Date(windowStart)
    windowEnd.setDate(windowEnd.getDate() + 2)
    windowEnd.setHours(23, 59, 59, 999)

    // Normalize busy intervals into Date objects
    const busyIntervals = busy.map(b => ({ start: new Date(b.start), end: new Date(b.end) }))

    // Iterate every 30 minutes to find first 3 non-overlapping slots
    const stepMs = 30 * 60 * 1000
    for (let t = originalStart.getTime(); t + durationMs <= windowEnd.getTime(); t += stepMs) {
      const candidateStart = new Date(t)
      if (candidateStart < windowStart) continue
      const candidateEnd = new Date(t + durationMs)
      const overlaps = busyIntervals.some(b => intervalsOverlap(candidateStart, candidateEnd, b.start, b.end))
      if (!overlaps) {
        suggestions.push({ start: candidateStart.toISOString(), end: candidateEnd.toISOString() })
      }
      if (suggestions.length >= 3) break
    }
    return suggestions
  }

  const checkConflicts = async (plan: EventPlan) => {
    setCheckingConflictsFor(plan.id)
    setError(null)
    try {
      // Query a wider window (start-of-day to +2 days) so we can compute suggestions locally
      const start = new Date(plan.startDateTime)
      const dayStart = new Date(start)
      dayStart.setHours(0,0,0,0)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 2)
      dayEnd.setHours(23,59,59,999)

      const resp = await fetch('/api/calendar/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          items: [{ id: 'primary' }]
        })
      })
      const data = await resp.json()
      const busy = data?.calendars?.primary?.busy || []
      setPlanConflicts(prev => ({ ...prev, [plan.id]: { busy } }))

      // Compute suggestions that avoid busy intervals
      const suggestions = computeSuggestions(plan, busy)
      setPlanSuggestions(prev => ({ ...prev, [plan.id]: suggestions }))
    } catch (e) {
      setError('Failed to check conflicts')
    } finally {
      setCheckingConflictsFor(null)
    }
  }

  const applySuggestion = (planId: string, suggestion: { start: string, end: string }) => {
    setEditedPlans(prev => prev.map(plan => plan.id === planId ? ({ ...plan, startDateTime: suggestion.start, endDateTime: suggestion.end }) : plan))
    setEditingPlan(planId)
  }

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatDateForInput = (dateTime: string) => {
    return new Date(dateTime).toISOString().slice(0, 16)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100'
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const handleAddToCalendar = async (plan: EventPlan) => {
    try {
      const demo = process.env.NEXT_PUBLIC_DEMO_MODE !== 'false'
      let headers: Record<string, string> = { 'Content-Type': 'application/json' }
      // Lazy import useSession hook data by reading from window if available is overkill; keep simple: rely on backend demo unless demo disabled.
      // In real mode, frontend route should attach bearer in its route handler. For now, demo path stays.

      const resp = await fetch('/api/calendar/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: plan.title,
          description: plan.description,
          startDateTime: plan.startDateTime,
          endDateTime: plan.endDateTime,
          location: plan.location,
          attendees: plan.attendees,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        setSuccessBanner(null)
        setError(`Failed to create event${err.error ? `: ${err.error}` : ''}`)
        return
      }
      const data = await resp.json()
      setError(null)
      setSuccessBanner(`Event created${data.data?.htmlLink ? `: ${data.data.htmlLink}` : ` (demo): ${data.data.id}`}`)

      // Write audit log (fire-and-forget)
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calendar.create',
          detail: {
            planId: plan.id,
            title: plan.title,
            start: plan.startDateTime,
            end: plan.endDateTime,
            result: data?.data?.id || data?.data?.htmlLink || 'ok'
          }
        })
      }).catch(() => {})
    } catch (e) {
      setSuccessBanner(null)
      setError('Failed to create event')
    }
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <SparklesIcon className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Schedule with Natural Language
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Try: 'Block 7–9pm Tu/Th for EE labs; avoid Fridays' or 'Study sessions 3 hours/week, prefer mornings'"
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24 text-gray-900 placeholder-gray-500"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Examples: recurring events, time preferences, conflict avoidance
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <PaperAirplaneIcon className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error / Success Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}
      {successBanner && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="text-green-800">
            <strong>Success:</strong> {successBanner}
          </div>
        </div>
      )}

      {/* Results Section */}
      {response && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center space-x-2 mb-4">
              <CalendarIcon className="h-5 w-5 text-green-500" />
              <h3 className="text-lg font-semibold text-gray-900">
                Proposed Schedule
              </h3>
              <span className="text-sm text-gray-500">
                ({editedPlans.length} plan{editedPlans.length !== 1 ? 's' : ''})
              </span>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600">Original Request:</div>
              <div className="text-gray-900 font-medium">"{response.data.originalInput}"</div>
            </div>

            <div className="space-y-4">
              {editedPlans.map((plan, index) => {
                const isEditing = editingPlan === plan.id
                return (
                  <div key={plan.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        {isEditing ? (
                          <input
                            type="text"
                            value={plan.title}
                            onChange={(e) => updatePlanTitle(plan.id, e.target.value)}
                            className="text-lg font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 w-full"
                          />
                        ) : (
                          <h4 className="text-lg font-medium text-gray-900 mb-1">
                            {plan.title}
                          </h4>
                        )}
                        {plan.description && (
                          <p className="text-sm text-gray-600 mb-2">{plan.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(plan.confidence)}`}>
                          {Math.round(plan.confidence * 100)}% confident
                        </span>
                        {isEditing ? (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => saveEdit(plan.id)}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                              title="Save changes"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="Cancel changes"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(plan.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit schedule"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-gray-400" />
                        {isEditing ? (
                          <input
                            type="datetime-local"
                            value={formatDateForInput(plan.startDateTime)}
                            onChange={(e) => updatePlanDateTime(plan.id, 'startDateTime', e.target.value)}
                            className="font-medium bg-white border border-gray-300 rounded px-2 py-1"
                          />
                        ) : (
                          <span className="font-medium cursor-pointer hover:text-blue-600" onClick={() => startEditing(plan.id)}>
                            {formatDate(plan.startDateTime)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <ClockIcon className="h-4 w-4 text-gray-400" />
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="datetime-local"
                              value={formatDateForInput(plan.startDateTime)}
                              onChange={(e) => updatePlanDateTime(plan.id, 'startDateTime', e.target.value)}
                              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                            />
                            <span>-</span>
                            <input
                              type="datetime-local"
                              value={formatDateForInput(plan.endDateTime)}
                              onChange={(e) => updatePlanDateTime(plan.id, 'endDateTime', e.target.value)}
                              className="bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                            />
                          </div>
                        ) : (
                          <span className="cursor-pointer hover:text-blue-600" onClick={() => startEditing(plan.id)}>
                            {formatTime(plan.startDateTime)} - {formatTime(plan.endDateTime)}
                          </span>
                        )}
                      </div>
                    </div>

                    {plan.location && (
                      <div className="text-sm text-gray-600 mb-3">
                        📍 {plan.location}
                      </div>
                    )}

                    <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                      <strong>AI Explanation:</strong> {plan.explanation}
                    </div>

                    <div className="mt-4 flex space-x-3">
                      <button 
                        onClick={() => handleAddToCalendar(plan)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                      >
                        Add to Calendar
                      </button>
                      <button
                        onClick={() => checkConflicts(plan)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium transition-colors"
                        disabled={checkingConflictsFor === plan.id}
                        title="Check for conflicts"
                      >
                        {checkingConflictsFor === plan.id ? 'Checking…' : 'Check Conflicts'}
                      </button>
                      <button 
                        onClick={() => isEditing ? saveEdit(plan.id) : startEditing(plan.id)}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium transition-colors"
                      >
                        {isEditing ? 'Save Changes' : 'Modify'}
                      </button>
                    </div>

                    {planConflicts[plan.id]?.busy?.length ? (
                      <div className="mt-3 p-3 rounded bg-yellow-50 text-yellow-800 text-sm">
                        <div className="font-medium mb-1">Conflicts detected:</div>
                        <ul className="list-disc ml-5">
                          {planConflicts[plan.id].busy.map((b, i) => (
                            <li key={i}>{new Date(b.start).toLocaleString()} - {new Date(b.end).toLocaleString()}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {planSuggestions[plan.id]?.length ? (
                      <div className="mt-3 p-3 rounded bg-green-50 text-green-800 text-sm">
                        <div className="font-medium mb-1">Suggested alternatives:</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {planSuggestions[plan.id].map((s, i) => (
                            <button key={i} onClick={() => applySuggestion(plan.id, s)} className="px-2 py-1 border border-green-300 rounded hover:bg-green-100 text-left">
                              {new Date(s.start).toLocaleString()} → {new Date(s.end).toLocaleString()}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Help Section */}
      {!response && (
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            How to use the Scheduling Copilot
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Time blocks:</strong> "Study 7-9pm Tuesday/Thursday"</p>
            <p>• <strong>Recurring events:</strong> "Gym sessions 3x per week, mornings preferred"</p>
            <p>• <strong>Constraints:</strong> "Avoid Fridays, no events before 8am"</p>
            <p>• <strong>Conflicts:</strong> "Work around my existing lab schedule"</p>
            <p>• <strong>Duration:</strong> "2-hour study blocks for calculus"</p>
          </div>
        </div>
      )}

      {/* Audit Panel */}
      <AuditPanel />
    </div>
  )
}