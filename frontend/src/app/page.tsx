'use client'

import { useState } from 'react'
import SchedulingInterface from '@/components/SchedulingInterface'
import SyllabusUpload from '@/components/SyllabusUpload'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'scheduling' | 'syllabus'>('scheduling')

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Student Scheduling Copilot
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Demo Mode
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tab Navigation */}
          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('scheduling')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'scheduling'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Natural Language Scheduling
              </button>
              <button
                onClick={() => setActiveTab('syllabus')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'syllabus'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Syllabus Upload & RAG
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'scheduling' && <SchedulingInterface />}
          {activeTab === 'syllabus' && <SyllabusUpload />}
        </div>
      </main>
    </div>
  )
}