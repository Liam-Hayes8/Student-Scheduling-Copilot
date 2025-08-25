'use client'

import { useState, useRef } from 'react'
import { DocumentArrowUpIcon, MagnifyingGlassIcon, CalendarIcon } from '@heroicons/react/24/outline'

interface SyllabusEvent {
  id: string
  title: string
  date: string
  type: 'exam' | 'assignment' | 'quiz' | 'project' | 'other'
  description?: string
  course?: string
  confidence: number
  sourceText: string
}

interface SyllabusAnalysis {
  events: SyllabusEvent[]
  courseInfo: {
    name?: string
    instructor?: string
    semester?: string
  }
  summary: string
}

export default function SyllabusUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [analysis, setAnalysis] = useState<SyllabusAnalysis | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SyllabusEvent[]>([])
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set())
  const [isImporting, setIsImporting] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [successBanner, setSuccessBanner] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [snippets, setSnippets] = useState<{ content: string; pageNumber?: number; chunkIndex?: number }[]>([])
  const [conflictMap, setConflictMap] = useState<Record<string, { start: string; end: string }[]>>({})
  const [editTimes, setEditTimes] = useState<Record<string, { date: string; time: string; durationMins: number }>>({})

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      setErrorBanner('Please upload a PDF file')
      return
    }

    setIsUploading(true)
    setErrorBanner(null)
    setSuccessBanner(null)
    const formData = new FormData()
    formData.append('syllabus', file)
    formData.append('userId', 'demo-user')

    try {
      const response = await fetch('/api/syllabus/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload syllabus')
      }

      const data = await response.json()
      setAnalysis(data.data)
      setSuccessBanner(data.data?.summary || 'Syllabus processed')
    } catch (error) {
      setErrorBanner('Failed to upload syllabus. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setErrorBanner(null)
    setSuccessBanner(null)

    try {
      const response = await fetch(`/api/syllabus/search?userId=demo-user&query=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setSearchResults(data.data.events)
      setSuccessBanner(`Found ${data.data.count} matching event(s)`) 

      // Load top matching snippets (semantic when real API is enabled)
      const snp = await fetch(`/api/syllabus/snippets?userId=demo-user&query=${encodeURIComponent(searchQuery)}&limit=5`).then(r=>r.json()).catch(()=>({ data: { snippets: [] }}))
      setSnippets(snp?.data?.snippets || [])
    } catch (error) {
      setErrorBanner('Search failed. Please try again.')
    }
  }

  const handleImportEvents = async () => {
    if (selectedEvents.size === 0) return

    setIsImporting(true)
    setErrorBanner(null)
    setSuccessBanner(null)
    try {
      // For each selected syllabus event, check conflicts via freeBusy, then create if free
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const toImport = (analysis?.events || []).filter(e => selectedEvents.has(e.id))

      // Build time window spanning selected events
      const startMin = new Date(Math.min(...toImport.map(e => new Date(e.date).getTime())))
      const endMax = new Date(Math.max(...toImport.map(e => new Date(e.date).getTime())))
      // Expand to cover a whole day range for safety
      startMin.setHours(0,0,0,0)
      endMax.setHours(23,59,59,999)

      // Call conflicts endpoint (real mode requires auth)
      const fbResp = await fetch('/api/calendar/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeMin: startMin.toISOString(),
          timeMax: endMax.toISOString(),
          items: [{ id: 'primary' }]
        })
      })

      let busyBlocks: { start: string; end: string }[] = []
      if (fbResp.ok) {
        const fb = await fbResp.json()
        const cal = fb?.calendars?.primary
        busyBlocks = Array.isArray(cal?.busy) ? cal.busy : []
      } else {
        // In demo mode or if auth missing, proceed without blocking
        busyBlocks = []
      }

      // For each event, check overlap using edited times if provided
      const conflicts: Record<string, { start: string; end: string }[]> = {}
      const alternatives: Record<string, { start: string; end: string }[]> = {}
      const nonConflicting: typeof toImport = []

      for (const ev of toImport) {
        const userEdit = editTimes[ev.id]
        const base = userEdit ? new Date(`${userEdit.date}T${userEdit.time}:00`) : new Date(ev.date)
        if (!userEdit) base.setHours(12, 0, 0, 0)
        const duration = userEdit?.durationMins ?? 60
        const start = base
        const end = new Date(start.getTime() + duration * 60 * 1000)
        const overlaps = busyBlocks.filter(b => {
          const bs = new Date(b.start).getTime()
          const be = new Date(b.end).getTime()
          const es = start.getTime()
          const ee = end.getTime()
          return Math.max(bs, es) < Math.min(be, ee)
        })
        if (overlaps.length) {
          conflicts[ev.id] = overlaps
          // Suggest simple alternatives for the same day
          const sugg = computeAlternativesForDay(start, busyBlocks, duration)
          if (sugg.length) alternatives[ev.id] = sugg.slice(0, 3)
        } else {
          nonConflicting.push(ev)
        }
      }

      setConflictMap(conflicts)
      setAlternativesMap(alternatives)

      // Create only non-conflicting events
      let created = 0
      for (const ev of nonConflicting) {
        const userEdit = editTimes[ev.id]
        const base = userEdit ? new Date(`${userEdit.date}T${userEdit.time}:00`) : new Date(ev.date)
        if (!userEdit) base.setHours(12, 0, 0, 0)
        const duration = userEdit?.durationMins ?? 60
        const start = base
        const end = new Date(start.getTime() + duration * 60 * 1000)

        const resp = await fetch('/api/calendar/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: ev.title,
            description: ev.description || `Imported from syllabus (${ev.type})`,
            startDateTime: start.toISOString(),
            endDateTime: end.toISOString(),
            timeZone: tz
          })
        })
        if (resp.ok) created += 1
      }

      const conflictCount = Object.keys(conflicts).length
      const createdMsg = created > 0 ? `Created ${created} event(s)` : 'No events created'
      const conflictMsg = conflictCount > 0 ? `, ${conflictCount} had conflicts` : ''
      setSuccessBanner(`${createdMsg}${conflictMsg}`)
      setSelectedEvents(new Set())
      setEditTimes({})
    } catch (error) {
      setErrorBanner('Import failed. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  const onEditTimeChange = (eventId: string, field: 'date' | 'time' | 'durationMins', value: string) => {
    setEditTimes(prev => {
      const next = { ...prev }
      const cur = next[eventId] || { date: new Date().toISOString().slice(0,10), time: '12:00', durationMins: 60 }
      if (field === 'durationMins') {
        cur.durationMins = Math.max(15, Math.min(480, parseInt(value || '60', 10) || 60))
      } else if (field === 'date') {
        cur.date = value
      } else {
        cur.time = value
      }
      next[eventId] = cur
      return next
    })
  }

  const computeAlternativesForDay = (preferredStart: Date, busy: { start: string; end: string }[], durationMins: number) => {
    const day = new Date(preferredStart)
    const candidates: { start: string; end: string }[] = []
    const dayStart = new Date(day); dayStart.setHours(8,0,0,0)
    const dayEnd = new Date(day); dayEnd.setHours(20,0,0,0)
    const stepMs = 30 * 60 * 1000
    const durMs = durationMins * 60 * 1000
    for (let t = dayStart.getTime(); t + durMs <= dayEnd.getTime(); t += stepMs) {
      const s = new Date(t)
      const e = new Date(t + durMs)
      const overlaps = busy.some(b => {
        const bs = new Date(b.start).getTime()
        const be = new Date(b.end).getTime()
        return Math.max(bs, s.getTime()) < Math.min(be, e.getTime())
      })
      if (!overlaps) {
        candidates.push({ start: s.toISOString(), end: e.toISOString() })
        if (candidates.length >= 5) break
      }
    }
    return candidates
  }

  const useAlternative = (eventId: string, startISO: string, endISO: string) => {
    const start = new Date(startISO)
    const end = new Date(endISO)
    const y = start.getFullYear()
    const m = String(start.getMonth()+1).padStart(2,'0')
    const d = String(start.getDate()).padStart(2,'0')
    const hh = String(start.getHours()).padStart(2,'0')
    const mm = String(start.getMinutes()).padStart(2,'0')
    const durationMins = Math.max(15, Math.round((end.getTime()-start.getTime())/60000))
    setEditTimes(prev => ({ ...prev, [eventId]: { date: `${y}-${m}-${d}`, time: `${hh}:${mm}`, durationMins } }))
    setConflictMap(prev => { const next = { ...prev }; delete next[eventId]; return next })
  }

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents)
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId)
    } else {
      newSelected.add(eventId)
    }
    setSelectedEvents(newSelected)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getEventTypeColor = (type: string) => {
    const colors = {
      exam: 'bg-red-100 text-red-800',
      assignment: 'bg-blue-100 text-blue-800',
      quiz: 'bg-yellow-100 text-yellow-800',
      project: 'bg-purple-100 text-purple-800',
      other: 'bg-gray-100 text-gray-800'
    }
    return colors[type as keyof typeof colors] || colors.other
  }

  return (
    <div className="space-y-6">
      {/* Banners */}
      {errorBanner && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-red-800">
            <strong>Error:</strong> {errorBanner}
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

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <DocumentArrowUpIcon className="h-5 w-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            Upload Syllabus
          </h2>
        </div>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
                  Choose PDF Syllabus
                </>
              )}
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Upload your course syllabus to extract exam dates, assignments, and important deadlines
            </p>
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {analysis && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Syllabus Analysis
            </h3>
            <span className="text-sm text-gray-500">
              {analysis.events.length} events found
            </span>
          </div>

          {/* Course Info */}
          {analysis.courseInfo.name && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Course Information</h4>
              <div className="text-sm text-gray-600 space-y-1">
                {analysis.courseInfo.name && <p><strong>Course:</strong> {analysis.courseInfo.name}</p>}
                {analysis.courseInfo.instructor && <p><strong>Instructor:</strong> {analysis.courseInfo.instructor}</p>}
                {analysis.courseInfo.semester && <p><strong>Semester:</strong> {analysis.courseInfo.semester}</p>}
              </div>
            </div>
          )}

          {/* Events List */}
          <div className="space-y-3">
            {analysis.events.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium text-gray-900">{event.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {Math.round(event.confidence * 100)}% confident
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      <CalendarIcon className="h-4 w-4 inline mr-1" />
                      {formatDate(event.date)}
                    </p>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input
                        type="date"
                        value={editTimes[event.id]?.date || event.date.slice(0,10)}
                        onChange={(e) => onEditTimeChange(event.id, 'date', e.target.value)}
                        className="p-2 border border-gray-300 rounded text-gray-900"
                      />
                      <input
                        type="time"
                        value={editTimes[event.id]?.time || '12:00'}
                        onChange={(e) => onEditTimeChange(event.id, 'time', e.target.value)}
                        className="p-2 border border-gray-300 rounded text-gray-900"
                      />
                      <input
                        type="number"
                        min={15}
                        max={480}
                        step={15}
                        value={editTimes[event.id]?.durationMins ?? 60}
                        onChange={(e) => onEditTimeChange(event.id, 'durationMins', e.target.value)}
                        className="p-2 border border-gray-300 rounded text-gray-900"
                        placeholder="Duration (mins)"
                      />
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}
                    <p className="text-xs text-gray-500 italic">
                      Source: "{event.sourceText}"
                    </p>
                    {conflictMap[event.id] && (
                      <div className="mt-2 text-xs text-red-600">
                        Conflicts detected at:
                        <ul className="list-disc ml-5">
                          {conflictMap[event.id].map((b, idx) => (
                            <li key={idx}>{new Date(b.start).toLocaleTimeString()} - {new Date(b.end).toLocaleTimeString()}</li>
                          ))}
                        </ul>
                        {alternativesMap[event.id]?.length ? (
                          <div className="mt-2 text-gray-700">
                            <div className="mb-1">Suggested alternatives:</div>
                            <div className="flex flex-wrap gap-2">
                              {alternativesMap[event.id].map((alt, i) => (
                                <button
                                  key={i}
                                  onClick={() => useAlternative(event.id, alt.start, alt.end)}
                                  className="px-2 py-1 text-xs rounded border border-blue-300 text-blue-700 hover:bg-blue-50"
                                  title={`Use ${new Date(alt.start).toLocaleTimeString()} - ${new Date(alt.end).toLocaleTimeString()}`}
                                >
                                  {new Date(alt.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {' - '}
                                  {new Date(alt.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedEvents.has(event.id)}
                    onChange={() => toggleEventSelection(event.id)}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Import Button */}
          {selectedEvents.size > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleImportEvents}
                disabled={isImporting}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Import {selectedEvents.size} Event{selectedEvents.size !== 1 ? 's' : ''} to Calendar
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search Section */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center space-x-2 mb-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            Search Syllabus Events
          </h3>
        </div>

        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for exams, assignments, projects..."
            className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Search
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Search Results ({searchResults.length})</h4>
            {searchResults.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <h5 className="font-medium text-gray-900">{event.title}</h5>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.type)}`}>
                    {event.type}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {formatDate(event.date)} • {event.description}
                </p>
              </div>
            ))}

            {snippets.length > 0 && (
              <div className="mt-4">
                <h5 className="font-medium text-gray-900 mb-2">Top matching snippets</h5>
                <div className="space-y-2">
                  {snippets.map((s, i) => (
                    <div key={i} className="p-2 border border-gray-200 rounded bg-gray-50 text-sm text-gray-800">
                      <div className="mb-1 text-xs text-gray-500">Page {s.pageNumber ?? '-'} • Chunk {s.chunkIndex ?? '-'}</div>
                      <div className="whitespace-pre-wrap">{s.content.slice(0, 400)}{s.content.length > 400 ? '…' : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
