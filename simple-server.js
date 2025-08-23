const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: 'http://localhost:3004'
}));

app.use(express.json());

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
