import { EventPlan, SchedulingRequest, EventConstraints, TimeRange, RecurrenceRule } from '@/types/events';
import { v4 as uuidv4 } from 'uuid';

interface ParsedSchedule {
  title: string | undefined;
  duration: number | undefined;
  timeSlots: string[];
  frequency: string | undefined;
  daysOfWeek: string[];
  constraints: EventConstraints;
}

export class PlannerService {
  
  async createEventPlan(request: SchedulingRequest): Promise<EventPlan[]> {
    const parsed = this.parseNaturalLanguage(request.naturalLanguageInput);
    const timeSlots = this.generateTimeSlots(parsed, request.naturalLanguageInput);
    
    return timeSlots.map((slot, index) => ({
      id: uuidv4(),
      title: parsed.title || this.extractTitle(request.naturalLanguageInput) || 'Untitled Event',
      description: this.extractDescription(request.naturalLanguageInput) || undefined,
      startDateTime: slot.start,
      endDateTime: slot.end,
      location: this.extractLocation(request.naturalLanguageInput) || undefined,
      attendees: this.extractAttendees(request.naturalLanguageInput) || undefined,
      recurrence: this.extractRecurrence(request.naturalLanguageInput) || undefined,
      constraints: parsed.constraints,
      confidence: this.calculateConfidence(request.naturalLanguageInput, slot),
      explanation: this.generateExplanation(request.naturalLanguageInput, slot, parsed.constraints)
    }));
  }

  private parseNaturalLanguage(input: string): ParsedSchedule {
    const normalizedInput = input.toLowerCase();
    
    return {
      title: this.extractTitle(input),
      duration: this.extractDuration(normalizedInput),
      timeSlots: this.extractTimeSlots(normalizedInput),
      frequency: this.extractFrequency(normalizedInput),
      daysOfWeek: this.extractDaysOfWeek(normalizedInput),
      constraints: this.extractConstraints(input)
    };
  }

  private extractConstraints(input: string): EventConstraints {
    const constraints: EventConstraints = {};
    
    const avoidDaysPattern = /avoid\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekends?|fridays?)/gi;
    const avoidMatches = input.match(avoidDaysPattern);
    if (avoidMatches) {
      constraints.avoidDays = avoidMatches.map(match => 
        match.replace(/avoid\s+/i, '').toUpperCase()
      );
    }

    const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–—]\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi;
    const timeMatches = input.match(timePattern);
    if (timeMatches) {
      constraints.preferredTimes = timeMatches.map(match => this.parseTimeRange(match));
    }

    const durationPattern = /(\d+)\s*(hour|hr|minute|min)s?/gi;
    const durationMatch = input.match(durationPattern);
    if (durationMatch) {
      constraints.maxDuration = this.parseDuration(durationMatch[0]);
    }

    return constraints;
  }

  private generateTimeSlots(parsed: ParsedSchedule, input: string): TimeRange[] {
    const today = new Date();
    const slots: TimeRange[] = [];

    if (parsed.timeSlots.length > 0) {
      parsed.timeSlots.forEach(timeSlot => {
        if (parsed.daysOfWeek && parsed.daysOfWeek.length > 0) {
          parsed.daysOfWeek.forEach(day => {
            const slot = this.createTimeSlotForDay(day, timeSlot, parsed.duration || 120, today);
            if (slot) slots.push(slot);
          });
        } else {
          const slot = this.createDefaultTimeSlot(timeSlot, parsed.duration || 120, today);
          if (slot) slots.push(slot);
        }
      });
    } else {
      const defaultSlots = this.getDefaultTimeSlots(today);
      slots.push(...defaultSlots);
    }

    return slots.filter(slot => {
      if (parsed.constraints.avoidDays) {
        const dayOfWeek = new Date(slot.start).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        return !parsed.constraints.avoidDays.includes(dayOfWeek);
      }
      return true;
    });
  }

  private extractDuration(input: string): number {
    const durationPattern = /(\d+)\s*(hour|hr|minute|min)s?/i;
    const match = input.match(durationPattern);
    if (match && match[1] && match[2]) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return unit.startsWith('hour') || unit.startsWith('hr') ? value * 60 : value;
    }
    return 120; // default 2 hours
  }

  private extractTimeSlots(input: string): string[] {
    const timePatterns = [
      /(\d{1,2}):?(\d{2})?\s*(am|pm)?\s*[-–—]\s*(\d{1,2}):?(\d{2})?\s*(am|pm)?/gi,
      /(\d{1,2})\s*(am|pm)/gi
    ];

    const slots: string[] = [];
    
    timePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(input)) !== null) {
        slots.push(match[0]);
      }
    });

    return slots.length > 0 ? slots : ['7pm'];
  }

  private extractFrequency(input: string): string | undefined {
    if (/daily|every\s+day/i.test(input)) return 'DAILY';
    if (/weekly|every\s+week/i.test(input)) return 'WEEKLY';
    if (/monthly|every\s+month/i.test(input)) return 'MONTHLY';
    if (/(\d+)x?\s*(per|\/)\s*week/i.test(input)) return 'WEEKLY';
    return undefined;
  }

  private extractDaysOfWeek(input: string): string[] {
    const dayMap: Record<string, string[]> = {
      'monday': ['MONDAY'], 'mon': ['MONDAY'],
      'tuesday': ['TUESDAY'], 'tue': ['TUESDAY'], 'tues': ['TUESDAY'],
      'wednesday': ['WEDNESDAY'], 'wed': ['WEDNESDAY'],
      'thursday': ['THURSDAY'], 'thu': ['THURSDAY'], 'thur': ['THURSDAY'], 'thurs': ['THURSDAY'],
      'friday': ['FRIDAY'], 'fri': ['FRIDAY'],
      'saturday': ['SATURDAY'], 'sat': ['SATURDAY'],
      'sunday': ['SUNDAY'], 'sun': ['SUNDAY'],
      'weekdays': ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
      'weekends': ['SATURDAY', 'SUNDAY'],
      'tu/th': ['TUESDAY', 'THURSDAY'],
      'tue/thu': ['TUESDAY', 'THURSDAY'],
      'monday/wednesday': ['MONDAY', 'WEDNESDAY'],
      'mon/wed': ['MONDAY', 'WEDNESDAY']
    };

    const days = new Set<string>();
    
    Object.entries(dayMap).forEach(([pattern, dayList]) => {
      if (new RegExp(pattern, 'i').test(input)) {
        dayList.forEach(day => days.add(day));
      }
    });

    return Array.from(days);
  }

  private createTimeSlotForDay(day: string, timeSlot: string, duration: number, baseDate: Date): TimeRange | null {
    const dayIndex = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].indexOf(day);
    if (dayIndex === -1) return null;

    const targetDate = new Date(baseDate);
    const currentDay = targetDate.getDay();
    const daysToAdd = (dayIndex - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysToAdd);

    const startTime = this.parseTimeString(timeSlot);
    if (!startTime) return null;

    const start = new Date(targetDate);
    start.setHours(startTime.hours, startTime.minutes, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  private createDefaultTimeSlot(timeSlot: string, duration: number, baseDate: Date): TimeRange | null {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startTime = this.parseTimeString(timeSlot);
    if (!startTime) return null;

    const start = new Date(tomorrow);
    start.setHours(startTime.hours, startTime.minutes, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  private getDefaultTimeSlots(baseDate: Date): TimeRange[] {
    const today = new Date(baseDate);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return [
      {
        start: new Date(tomorrow.setHours(19, 0, 0, 0)).toISOString(),
        end: new Date(tomorrow.setHours(21, 0, 0, 0)).toISOString()
      }
    ];
  }

  private parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
    const timePattern = /(\d{1,2}):?(\d{2})?\s*(am|pm)?/i;
    const match = timeStr.match(timePattern);
    
    if (!match || !match[1]) return null;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2] || '0');
    const meridiem = match[3]?.toLowerCase();

    if (meridiem === 'pm' && hours !== 12) {
      hours += 12;
    } else if (meridiem === 'am' && hours === 12) {
      hours = 0;
    } else if (!meridiem && hours < 8) {
      hours += 12; // assume PM for times like "7" meaning 7pm
    }

    return { hours, minutes };
  }

  private extractTitle(input: string): string | undefined {
    const patterns = [
      /(?:for|study|class|lab|meeting|session|work|exam|assignment)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:class|lab|session|at|on|from|every))/i,
      /^([a-zA-Z0-9\s]+?)(?:\s+(?:from|at|on|every|7|8|9|10|11|12|1|2|3|4|5|6))/i
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  private extractDescription(input: string): string | undefined {
    if (input.length > 50) {
      return `Auto-generated from: "${input}"`;
    }
    return undefined;
  }

  private extractLocation(input: string): string | undefined {
    const locationPattern = /(?:at|in|room|building)\s+([a-zA-Z0-9\s]+)/i;
    const match = input.match(locationPattern);
    return match ? match[1].trim() : undefined;
  }

  private extractAttendees(input: string): string[] | undefined {
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emails = input.match(emailPattern);
    return emails || undefined;
  }

  private extractRecurrence(input: string): any {
    const patterns = {
      daily: /every\s+day|daily/i,
      weekly: /every\s+week|weekly|(?:mon|tue|wed|thu|fri|sat|sun)/i,
      monthly: /every\s+month|monthly/i
    };

    for (const [frequency, pattern] of Object.entries(patterns)) {
      if (pattern.test(input)) {
        return {
          frequency: frequency.toUpperCase(),
          interval: 1
        };
      }
    }

    return undefined;
  }

  private parseTimeRange(timeStr: string): TimeRange {
    return {
      start: '19:00',
      end: '21:00'
    };
  }

  private parseDuration(durationStr: string): number {
    const match = durationStr.match(/(\d+)\s*(hour|hr|minute|min)/i);
    if (match && match[1] && match[2]) {
      const value = parseInt(match[1]);
      const unit = match[2].toLowerCase();
      return unit.startsWith('hour') || unit.startsWith('hr') ? value * 60 : value;
    }
    return 120; // default 2 hours
  }

  private calculateConfidence(input: string, slot: TimeRange): number {
    let confidence = 0.7; // base confidence

    if (input.includes('7') || input.includes('8') || input.includes('9')) confidence += 0.1;
    if (input.includes('pm') || input.includes('PM')) confidence += 0.1;
    if (input.includes('tu') || input.includes('th') || input.includes('tuesday') || input.includes('thursday')) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private generateExplanation(input: string, slot: TimeRange, constraints: EventConstraints): string {
    const explanations = [
      `Scheduled based on your request: "${input}"`,
      `Time slot: ${new Date(slot.start).toLocaleTimeString()} - ${new Date(slot.end).toLocaleTimeString()}`
    ];

    if (constraints.avoidDays?.length) {
      explanations.push(`Avoided: ${constraints.avoidDays.join(', ')}`);
    }

    return explanations.join('. ');
  }
}