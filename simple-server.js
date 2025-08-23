const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: 'http://localhost:3004'
}));

app.use(express.json());

// In-memory mock syllabus events for demo
let mockSyllabusEvents = [
  {
    id: 'syll_1',
    title: 'Midterm Exam',
    date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'exam',
    description: 'Midterm exam for the course',
    confidence: 0.9,
    sourceText: 'Midterm Exam next week'
  },
  {
    id: 'syll_2',
    title: 'Project Milestone 1',
    date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    type: 'project',
    description: 'First milestone due',
    confidence: 0.8,
    sourceText: 'Milestone 1 due in two weeks'
  }
];

app.post('/api/planner/analyze', (req, res) => {
  console.log('Received request:', req.body);
  
  const { naturalLanguageInput } = req.body;
  
  if (!naturalLanguageInput) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing naturalLanguageInput' 
    });
  }

  // Simple mock response for testing
  const mockPlans = [
    {
      id: '1',
      title: 'Study Session',
      description: 'Auto-generated from your request',
      startDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      endDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // +2 hours
      location: undefined,
      attendees: undefined,
      recurrence: undefined,
      constraints: {},
      confidence: 0.8,
      explanation: `Scheduled based on your request: "${naturalLanguageInput}"`
    }
  ];

  res.json({
    success: true,
    data: {
      plans: mockPlans,
      originalInput: naturalLanguageInput,
      timestamp: new Date().toISOString()
    }
  });
});

// Mock syllabus upload (accepts multipart or JSON; returns preset events)
app.post('/api/syllabus/upload', (req, res) => {
  res.json({
    success: true,
    data: {
      events: mockSyllabusEvents,
      courseInfo: {
        name: 'CS 101',
        instructor: 'Dr. Smith',
        semester: 'Fall 2024'
      },
      summary: `Extracted ${mockSyllabusEvents.length} events from syllabus (demo)`
    }
  });
});

// Mock syllabus search
app.get('/api/syllabus/search', (req, res) => {
  const query = (req.query.query || '').toString().toLowerCase();
  const filtered = mockSyllabusEvents.filter(e =>
    e.title.toLowerCase().includes(query) ||
    (e.description || '').toLowerCase().includes(query) ||
    e.type.toLowerCase().includes(query)
  );
  res.json({
    success: true,
    data: {
      events: filtered,
      query,
      count: filtered.length
    }
  });
});

// Mock syllabus import (prepare calendar events)
app.post('/api/syllabus/import-events', (req, res) => {
  const { eventIds } = req.body || {};
  const selected = Array.isArray(eventIds)
    ? mockSyllabusEvents.filter(e => eventIds.includes(e.id))
    : [];
  const calendarEvents = selected.map(event => ({
    title: event.title,
    description: event.description || `Imported from syllabus: ${event.sourceText}`,
    startDateTime: event.date,
    endDateTime: new Date(new Date(event.date).getTime() + 60 * 60 * 1000).toISOString(),
    location: undefined,
    attendees: undefined
  }));
  res.json({
    success: true,
    data: {
      events: calendarEvents,
      imported: calendarEvents.length,
      message: `Prepared ${calendarEvents.length} events for calendar import (demo)`
    }
  });
});

// Mock calendar create
app.post('/api/calendar/create', (req, res) => {
  const event = req.body || {};
  if (!event.title || !event.startDateTime || !event.endDateTime) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  const id = 'cal_' + Math.random().toString(36).slice(2, 10);
  res.json({ success: true, data: { id, event } });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'demo'
  });
});

app.listen(3006, () => {
  console.log('🚀 Simple API Server running on port 3006');
  console.log('📊 Health check: http://localhost:3006/api/health');
  console.log('🎯 Demo mode - no database or authentication required');
});
