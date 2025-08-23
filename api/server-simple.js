const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3005;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3004',
  credentials: true
}));
app.use(limiter);
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple planner endpoint
app.post('/api/planner/analyze', (req, res) => {
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

  return res.json({
    success: true,
    data: {
      plans: mockPlans,
      originalInput: naturalLanguageInput,
      timestamp: new Date().toISOString()
    }
  });
});

// Syllabus upload endpoint (mock)
app.post('/api/syllabus/upload', (req, res) => {
  res.json({
    success: true,
    data: {
      events: [
        {
          id: '1',
          title: 'Midterm Exam',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          type: 'exam',
          description: 'Midterm exam for the course',
          confidence: 0.9,
          sourceText: 'Midterm Exam on next week'
        }
      ],
      courseInfo: {
        name: 'CS 101',
        instructor: 'Dr. Smith',
        semester: 'Fall 2024'
      },
      summary: 'Extracted 1 events from syllabus'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mode: 'demo'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Simple API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎯 Demo mode - no database or authentication required`);
});
