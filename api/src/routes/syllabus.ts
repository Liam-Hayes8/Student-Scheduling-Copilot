import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { RAGService } from '@/modules/rag';
import { createError } from '@/middleware/error';

const router = Router();
const ragService = new RAGService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if ((file.mimetype && file.mimetype.includes('pdf')) || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

// Upload and process syllabus
router.post('/upload', upload.single('syllabus'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw createError('No file uploaded', 400);
    }

    const userId = req.body.userId || 'temp-user-id'; // In production, get from auth

    const analysis = await ragService.processSyllabus(req.file.buffer, userId, req.file.originalname);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    next(error);
  }
});

// Search syllabus events
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, query } = req.query;

    if (!userId || !query) {
      throw createError('Missing required parameters: userId, query', 400);
    }

    const events = await ragService.searchSyllabus(userId as string, query as string);

    res.json({
      success: true,
      data: {
        events,
        query: query as string,
        count: events.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get upcoming syllabus events
router.get('/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, days } = req.query;

    if (!userId) {
      throw createError('Missing required parameter: userId', 400);
    }

    const daysCount = days ? parseInt(days as string) : 30;
    const events = await ragService.getUpcomingEvents(userId as string, daysCount);

    res.json({
      success: true,
      data: {
        events,
        days: daysCount,
        count: events.length
      }
    });
  } catch (error) {
    next(error);
  }
});

// Semantic snippets (top matching chunks)
router.get('/snippets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, query, limit } = req.query
    if (!userId || !query) {
      throw createError('Missing required parameters: userId, query', 400)
    }
    const lim = limit ? parseInt(limit as string, 10) : 5
    const chunks = await (ragService as any).semanticSearchChunks(userId as string, query as string, lim)
    res.json({ success: true, data: { snippets: chunks?.map((c: any) => ({
      content: c.content,
      pageNumber: c.pageNumber,
      chunkIndex: c.chunkIndex
    })) || [] } })
  } catch (error) {
    next(error)
  }
})

// Import syllabus events to calendar
router.post('/import-events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, eventIds, calendarId } = req.body;

    if (!userId || !eventIds || !Array.isArray(eventIds)) {
      throw createError('Missing required parameters: userId, eventIds (array)', 400);
    }

    // Get the events from the database
    const events = await ragService.getUpcomingEvents(userId, 365); // Get all events
    const selectedEvents = events.filter(event => eventIds.includes(event.id));

    if (selectedEvents.length === 0) {
      throw createError('No valid events found', 400);
    }

    // Convert to calendar events and add to calendar
    // This would integrate with your Calendar Agent
    const calendarEvents = selectedEvents.map(event => ({
      title: event.title,
      description: event.description || `Imported from syllabus: ${event.sourceText}`,
      startDateTime: event.date,
      endDateTime: new Date(new Date(event.date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour default
      location: undefined,
      attendees: undefined
    }));

    res.json({
      success: true,
      data: {
        events: calendarEvents,
        imported: selectedEvents.length,
        message: `Successfully prepared ${selectedEvents.length} events for calendar import`
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
