import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { EventPlan, CalendarEvent, ConflictResolution, CalendarConflict, EventAlternative } from '@/types/events';

export interface CalendarCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

export class CalendarAgentService {
  private oauth2Client: OAuth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async getEvents(
    credentials: CalendarCredentials,
    startDate: Date,
    endDate: Date,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent[]> {
    try {
      this.setCredentials(credentials);
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const response = await calendar.events.list({
        calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250
      });

      const events = response.data.items || [];
      
      return events.map(event => ({
        id: event.id!,
        title: event.summary || 'Untitled Event',
        description: event.description,
        start: {
          dateTime: event.start?.dateTime || event.start?.date + 'T00:00:00',
          timeZone: event.start?.timeZone
        },
        end: {
          dateTime: event.end?.dateTime || event.end?.date + 'T23:59:59',
          timeZone: event.end?.timeZone
        },
        location: event.location,
        attendees: event.attendees?.map(attendee => ({ email: attendee.email! })),
        recurrence: event.recurrence,
        source: 'GOOGLE_CALENDAR'
      }));

    } catch (error) {
      console.error('Error fetching calendar events:', error);
      throw new Error('Failed to fetch calendar events');
    }
  }

  async checkConflicts(
    eventPlan: EventPlan,
    credentials: CalendarCredentials,
    calendarId: string = 'primary'
  ): Promise<ConflictResolution> {
    try {
      const eventStart = new Date(eventPlan.startDateTime);
      const eventEnd = new Date(eventPlan.endDateTime);

      // Fetch events for the day to check conflicts
      const dayStart = new Date(eventStart);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(eventStart);
      dayEnd.setHours(23, 59, 59, 999);

      const existingEvents = await this.getEvents(credentials, dayStart, dayEnd, calendarId);
      
      const conflicts = this.detectConflicts(eventPlan, existingEvents);
      const alternatives = await this.generateAlternatives(eventPlan, existingEvents, credentials);

      return {
        conflicts,
        alternatives,
        recommendation: this.generateRecommendation(conflicts, alternatives)
      };

    } catch (error) {
      console.error('Error checking conflicts:', error);
      throw new Error('Failed to check calendar conflicts');
    }
  }

  async createEvent(
    eventPlan: EventPlan,
    credentials: CalendarCredentials,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    try {
      this.setCredentials(credentials);
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const eventResource = {
        summary: eventPlan.title,
        description: eventPlan.description,
        start: {
          dateTime: eventPlan.startDateTime,
          timeZone: 'America/Los_Angeles' // TODO: Get from user preferences
        },
        end: {
          dateTime: eventPlan.endDateTime,
          timeZone: 'America/Los_Angeles'
        },
        location: eventPlan.location,
        attendees: eventPlan.attendees?.map(email => ({ email })),
        recurrence: eventPlan.recurrence ? this.buildRecurrenceRule(eventPlan.recurrence) : undefined
      };

      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventResource
      });

      const createdEvent = response.data;

      return {
        id: createdEvent.id!,
        title: createdEvent.summary!,
        description: createdEvent.description,
        start: {
          dateTime: createdEvent.start?.dateTime!,
          timeZone: createdEvent.start?.timeZone
        },
        end: {
          dateTime: createdEvent.end?.dateTime!,
          timeZone: createdEvent.end?.timeZone
        },
        location: createdEvent.location,
        attendees: createdEvent.attendees?.map(attendee => ({ email: attendee.email! })),
        recurrence: createdEvent.recurrence,
        source: 'GENERATED'
      };

    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  async updateEvent(
    eventId: string,
    eventPlan: EventPlan,
    credentials: CalendarCredentials,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    try {
      this.setCredentials(credentials);
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      const eventResource = {
        summary: eventPlan.title,
        description: eventPlan.description,
        start: {
          dateTime: eventPlan.startDateTime,
          timeZone: 'America/Los_Angeles'
        },
        end: {
          dateTime: eventPlan.endDateTime,
          timeZone: 'America/Los_Angeles'
        },
        location: eventPlan.location,
        attendees: eventPlan.attendees?.map(email => ({ email }))
      };

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventResource
      });

      const updatedEvent = response.data;

      return {
        id: updatedEvent.id!,
        title: updatedEvent.summary!,
        description: updatedEvent.description,
        start: {
          dateTime: updatedEvent.start?.dateTime!,
          timeZone: updatedEvent.start?.timeZone
        },
        end: {
          dateTime: updatedEvent.end?.dateTime!,
          timeZone: updatedEvent.end?.timeZone
        },
        location: updatedEvent.location,
        attendees: updatedEvent.attendees?.map(attendee => ({ email: attendee.email! })),
        source: 'GENERATED'
      };

    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw new Error('Failed to update calendar event');
    }
  }

  async deleteEvent(
    eventId: string,
    credentials: CalendarCredentials,
    calendarId: string = 'primary'
  ): Promise<void> {
    try {
      this.setCredentials(credentials);
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });

      await calendar.events.delete({
        calendarId,
        eventId
      });

    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw new Error('Failed to delete calendar event');
    }
  }

  private setCredentials(credentials: CalendarCredentials): void {
    this.oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate
    });
  }

  private detectConflicts(eventPlan: EventPlan, existingEvents: CalendarEvent[]): CalendarConflict[] {
    const conflicts: CalendarConflict[] = [];
    const planStart = new Date(eventPlan.startDateTime);
    const planEnd = new Date(eventPlan.endDateTime);

    existingEvents.forEach(event => {
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);

      // Check for overlaps
      if (planStart < eventEnd && planEnd > eventStart) {
        let conflictType: CalendarConflict['conflictType'] = 'OVERLAP';
        let severity: CalendarConflict['severity'] = 'MEDIUM';

        // Determine conflict type and severity
        if (planStart.getTime() === eventStart.getTime() && planEnd.getTime() === eventEnd.getTime()) {
          conflictType = 'OVERLAP';
          severity = 'HIGH';
        } else if (
          Math.abs(planStart.getTime() - eventEnd.getTime()) < 30 * 60 * 1000 ||
          Math.abs(planEnd.getTime() - eventStart.getTime()) < 30 * 60 * 1000
        ) {
          conflictType = 'ADJACENT';
          severity = 'LOW';
        }

        conflicts.push({
          eventId: event.id,
          title: event.title,
          start: event.start.dateTime,
          end: event.end.dateTime,
          conflictType,
          severity
        });
      }
    });

    return conflicts;
  }

  private async generateAlternatives(
    eventPlan: EventPlan,
    existingEvents: CalendarEvent[],
    credentials: CalendarCredentials
  ): Promise<EventAlternative[]> {
    const alternatives: EventAlternative[] = [];
    const originalStart = new Date(eventPlan.startDateTime);
    const duration = new Date(eventPlan.endDateTime).getTime() - originalStart.getTime();

    // Generate alternatives by shifting time
    const timeShifts = [
      { hours: 1, description: '1 hour later' },
      { hours: -1, description: '1 hour earlier' },
      { hours: 2, description: '2 hours later' },
      { hours: -2, description: '2 hours earlier' },
      { days: 1, description: 'next day' }
    ];

    let rank = 1;
    for (const shift of timeShifts) {
      const newStart = new Date(originalStart);
      
      if (shift.hours) {
        newStart.setHours(newStart.getHours() + shift.hours);
      }
      if (shift.days) {
        newStart.setDate(newStart.getDate() + shift.days);
      }

      const newEnd = new Date(newStart.getTime() + duration);

      const altPlan: EventPlan = {
        ...eventPlan,
        startDateTime: newStart.toISOString(),
        endDateTime: newEnd.toISOString()
      };

      // Check if this alternative has conflicts
      const altConflicts = this.detectConflicts(altPlan, existingEvents);
      const score = this.calculateAlternativeScore(altPlan, altConflicts, originalStart);

      if (score > 0.3) { // Only include reasonable alternatives
        alternatives.push({
          rank,
          plan: altPlan,
          score,
          reasoning: `Moved ${shift.description} to avoid conflicts`,
          tradeoffs: altConflicts.length > 0 ? [`Still has ${altConflicts.length} conflict(s)`] : []
        });
        rank++;
      }

      if (alternatives.length >= 3) break; // Limit to 3 alternatives
    }

    // Sort by score
    alternatives.sort((a, b) => b.score - a.score);

    return alternatives;
  }

  private calculateAlternativeScore(
    alternative: EventPlan,
    conflicts: CalendarConflict[],
    originalTime: Date
  ): number {
    let score = 1.0;

    // Penalize conflicts
    score -= conflicts.length * 0.3;
    score -= conflicts.filter(c => c.severity === 'HIGH').length * 0.4;

    // Penalize time shifts from original
    const timeDiff = Math.abs(new Date(alternative.startDateTime).getTime() - originalTime.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    score -= Math.min(hoursDiff * 0.1, 0.5);

    // Prefer business hours (9am - 6pm)
    const hour = new Date(alternative.startDateTime).getHours();
    if (hour >= 9 && hour <= 18) {
      score += 0.1;
    } else if (hour < 7 || hour > 22) {
      score -= 0.2;
    }

    return Math.max(score, 0);
  }

  private generateRecommendation(conflicts: CalendarConflict[], alternatives: EventAlternative[]): string {
    if (conflicts.length === 0) {
      return 'No conflicts detected. The proposed time slot is available.';
    }

    const highSeverityConflicts = conflicts.filter(c => c.severity === 'HIGH');
    
    if (highSeverityConflicts.length > 0) {
      if (alternatives.length > 0) {
        return `Direct conflict detected with ${highSeverityConflicts[0].title}. Recommend using alternative option ${alternatives[0].rank}.`;
      } else {
        return 'Direct conflict detected. Please choose a different time.';
      }
    }

    if (alternatives.length > 0 && alternatives[0].score > 0.7) {
      return `Minor conflicts detected. Alternative option ${alternatives[0].rank} provides better scheduling.`;
    }

    return 'Some scheduling conflicts detected. Review the options and choose your preference.';
  }

  private buildRecurrenceRule(recurrence: EventPlan['recurrence']): string[] {
    if (!recurrence) return [];

    let rule = `RRULE:FREQ=${recurrence.frequency}`;
    
    if (recurrence.interval && recurrence.interval > 1) {
      rule += `;INTERVAL=${recurrence.interval}`;
    }

    if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
      const days = recurrence.daysOfWeek.map(day => day.substring(0, 2)).join(',');
      rule += `;BYDAY=${days}`;
    }

    if (recurrence.endDate) {
      const endDate = new Date(recurrence.endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      rule += `;UNTIL=${endDate}`;
    } else if (recurrence.count) {
      rule += `;COUNT=${recurrence.count}`;
    }

    return [rule];
  }
}