export interface EventPlan {
  id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  attendees?: string[];
  recurrence?: RecurrenceRule;
  constraints: EventConstraints;
  confidence: number;
  explanation: string;
}

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  daysOfWeek?: string[];
  endDate?: string;
  count?: number;
}

export interface EventConstraints {
  avoidDays?: string[];
  preferredTimes?: TimeRange[];
  conflictsWith?: string[];
  mustAvoid?: TimeRange[];
  maxDuration?: number;
  minDuration?: number;
}

export interface TimeRange {
  start: string;
  end: string;
  dayOfWeek?: string;
}

export interface ConflictResolution {
  conflicts: CalendarConflict[];
  alternatives: EventAlternative[];
  recommendation: string;
}

export interface CalendarConflict {
  eventId: string;
  title: string;
  start: string;
  end: string;
  conflictType: 'OVERLAP' | 'ADJACENT' | 'CONSTRAINT_VIOLATION';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface EventAlternative {
  rank: number;
  plan: EventPlan;
  score: number;
  reasoning: string;
  tradeoffs: string[];
}

export interface UserPreferences {
  userId: string;
  workingHours: TimeRange;
  breakDuration: number;
  preferredDays: string[];
  avoidDays: string[];
  timeZone: string;
  defaultEventDuration: number;
}

export interface SchedulingRequest {
  userId: string;
  naturalLanguageInput: string;
  context?: {
    existingEvents?: CalendarEvent[];
    userPreferences?: UserPreferences;
    syllabus?: SyllabusData[];
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: { email: string }[];
  recurrence?: string[];
  source: 'GOOGLE_CALENDAR' | 'IMPORTED' | 'GENERATED';
}

export interface SyllabusData {
  id: string;
  filename: string;
  content: string;
  extractedDates: ExtractedDate[];
  embeddings?: number[];
  uploadedAt: string;
}

export interface ExtractedDate {
  type: 'EXAM' | 'ASSIGNMENT' | 'CLASS' | 'HOLIDAY' | 'OTHER';
  title: string;
  date: string;
  time?: string;
  description?: string;
  confidence: number;
}