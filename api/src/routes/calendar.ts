import { Router, Request, Response, NextFunction } from 'express';
import { createError } from '@/middleware/error';
import { CalendarEvent, ConflictResolution, EventPlan } from '@/types/events';
import { CalendarAgentService } from '@/modules/calendar';

const router = Router();
const calendarService = new CalendarAgentService();

router.get('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, userId, accessToken } = req.query;

    if (!startDate || !endDate || !userId) {
      throw createError('Missing required parameters: startDate, endDate, userId', 400);
    }

    if (!accessToken) {
      throw createError('Missing access token for calendar access', 401);
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);
    
    const credentials = {
      accessToken: accessToken as string
    };

    const events = await calendarService.getEvents(credentials, start, end);

    res.json({
      success: true,
      data: {
        events,
        range: { startDate, endDate },
        count: events.length
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/check-conflicts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventPlan, userId, accessToken } = req.body;

    if (!eventPlan || !userId) {
      throw createError('Missing required fields: eventPlan, userId', 400);
    }

    if (!accessToken) {
      throw createError('Missing access token for calendar access', 401);
    }

    const credentials = {
      accessToken
    };

    const conflictResolution = await calendarService.checkConflicts(eventPlan, credentials);

    res.json({
      success: true,
      data: conflictResolution
    });
  } catch (error) {
    next(error);
  }
});

router.post('/create-event', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventPlan, userId, confirmed, accessToken, dryRun } = req.body;

    if (!eventPlan || !userId) {
      throw createError('Missing required fields: eventPlan, userId', 400);
    }

    if (!confirmed) {
      throw createError('Event creation must be explicitly confirmed', 400);
    }

    if (!accessToken && !dryRun) {
      throw createError('Missing access token for calendar access', 401);
    }

    if (dryRun) {
      // Dry run mode - don't actually create the event
      const mockEvent: CalendarEvent = {
        id: `dry-run-${Date.now()}`,
        title: eventPlan.title,
        description: eventPlan.description,
        start: { dateTime: eventPlan.startDateTime },
        end: { dateTime: eventPlan.endDateTime },
        location: eventPlan.location,
        attendees: eventPlan.attendees?.map(email => ({ email })),
        source: 'GENERATED'
      };

      res.json({
        success: true,
        data: {
          event: mockEvent,
          message: 'Event validation successful (dry run mode)',
          auditId: `audit-${Date.now()}`
        }
      });
    } else {
      // Actually create the event in Google Calendar
      const credentials = {
        accessToken
      };

      const createdEvent = await calendarService.createEvent(eventPlan, credentials);

      res.json({
        success: true,
        data: {
          event: createdEvent,
          message: 'Event created successfully in Google Calendar',
          auditId: `audit-${Date.now()}`
        }
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;