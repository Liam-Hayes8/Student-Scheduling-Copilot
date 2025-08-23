'use client'

import { useState, useRef } from 'react'
import { DocumentArrowUpIcon, MagnifyingGlassIcon, CalendarIcon, TrashIcon } from '@heroicons/react/24/outline'

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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('syllabus', file)
    formData.append('userId', 'temp-user-id') // In production, get from auth

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
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload syllabus. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    try {
      const response = await fetch(`/api/syllabus/search?userId=temp-user-id&query=${encodeURIComponent(searchQuery)}`)
      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setSearchResults(data.data.events)
    } catch (error) {
      console.error('Search error:', error)
      alert('Search failed. Please try again.')
    }
  }

  const handleImportEvents = async () => {
    if (selectedEvents.size === 0) return

    setIsImporting(true)
    try {
      const response = await fetch('/api/syllabus/import-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'temp-user-id',
          eventIds: Array.from(selectedEvents)
        })
      })

      if (!response.ok) throw new Error('Import failed')

      const data = await response.json()
      alert(`Successfully prepared ${data.data.imported} events for calendar import!`)
      setSelectedEvents(new Set())
    } catch (error) {
      console.error('Import error:', error)
      alert('Import failed. Please try again.')
    } finally {
      setIsImporting(false)
    }
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
                    {event.description && (
                      <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                    )}
                    <p className="text-xs text-gray-500 italic">
                      Source: "{event.sourceText}"
                    </p>
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
          </div>
        )}
      </div>
    </div>
  )
}
