import OpenAI from 'openai';
import { SchedulingRequest, EventPlan, EventConstraints, TimeRange, ConflictResolution } from '@/types/events';

export interface LLMResponse {
  intent: 'SCHEDULE_EVENT' | 'MODIFY_EVENT' | 'QUERY_CALENDAR' | 'UNCLEAR';
  extractedInfo: {
    title?: string;
    duration?: number;
    preferredTimes?: string[];
    daysOfWeek?: string[];
    frequency?: string;
    constraints?: EventConstraints;
    location?: string;
    attendees?: string[];
  };
  confidence: number;
  clarificationNeeded?: string[];
  suggestions?: string[];
}

export class LLMOrchestratorService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async analyzeRequest(request: SchedulingRequest): Promise<LLMResponse> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4-1106-preview',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: request.naturalLanguageInput
          }
        ],
        functions: [
          {
            name: 'extract_scheduling_info',
            description: 'Extract structured scheduling information from natural language',
            parameters: {
              type: 'object',
              properties: {
                intent: {
                  type: 'string',
                  enum: ['SCHEDULE_EVENT', 'MODIFY_EVENT', 'QUERY_CALENDAR', 'UNCLEAR'],
                  description: 'The primary intent of the user request'
                },
                title: {
                  type: 'string',
                  description: 'The event title or subject'
                },
                duration: {
                  type: 'number',
                  description: 'Duration in minutes'
                },
                preferredTimes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Preferred time slots (e.g., "7pm", "2:30pm")'
                },
                daysOfWeek: {
                  type: 'array',
                  items: { 
                    type: 'string',
                    enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']
                  },
                  description: 'Preferred days of the week'
                },
                frequency: {
                  type: 'string',
                  enum: ['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY'],
                  description: 'How often the event should repeat'
                },
                avoidDays: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Days to avoid scheduling'
                },
                avoidTimes: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Time ranges to avoid'
                },
                location: {
                  type: 'string',
                  description: 'Event location'
                },
                attendees: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Email addresses of attendees'
                },
                confidence: {
                  type: 'number',
                  minimum: 0,
                  maximum: 1,
                  description: 'Confidence in the extraction (0-1)'
                },
                clarificationNeeded: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Questions to ask the user for clarification'
                },
                suggestions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Helpful suggestions for the user'
                }
              },
              required: ['intent', 'confidence']
            }
          }
        ],
        function_call: { name: 'extract_scheduling_info' },
        temperature: 0.1
      });

      const functionCall = completion.choices[0]?.message?.function_call;
      if (!functionCall || !functionCall.arguments) {
        throw new Error('No function call response from OpenAI');
      }

      const extracted = JSON.parse(functionCall.arguments);
      
      return {
        intent: extracted.intent,
        extractedInfo: {
          title: extracted.title,
          duration: extracted.duration,
          preferredTimes: extracted.preferredTimes,
          daysOfWeek: extracted.daysOfWeek,
          frequency: extracted.frequency,
          constraints: {
            avoidDays: extracted.avoidDays,
            avoidTimes: extracted.avoidTimes?.map((time: string) => ({
              start: time,
              end: time
            }))
          },
          location: extracted.location,
          attendees: extracted.attendees
        },
        confidence: extracted.confidence,
        clarificationNeeded: extracted.clarificationNeeded,
        suggestions: extracted.suggestions
      };

    } catch (error) {
      console.error('LLM analysis error:', error);
      return this.getFallbackResponse(request.naturalLanguageInput);
    }
  }

  async generateEventPlan(
    extractedInfo: LLMResponse['extractedInfo'],
    originalRequest: string
  ): Promise<EventPlan[]> {
    const baseDate = new Date();
    const plans: EventPlan[] = [];

    if (!extractedInfo.title) {
      extractedInfo.title = 'Untitled Event';
    }

    const timeSlots = this.generateTimeSlots(extractedInfo, baseDate);
    
    timeSlots.forEach(slot => {
      plans.push({
        id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: extractedInfo.title!,
        description: `Generated from: "${originalRequest}"`,
        startDateTime: slot.start,
        endDateTime: slot.end,
        location: extractedInfo.location,
        attendees: extractedInfo.attendees,
        recurrence: extractedInfo.frequency && extractedInfo.frequency !== 'ONCE' ? {
          frequency: extractedInfo.frequency as 'DAILY' | 'WEEKLY' | 'MONTHLY',
          interval: 1,
          daysOfWeek: extractedInfo.daysOfWeek
        } : undefined,
        constraints: extractedInfo.constraints || {},
        confidence: 0.85,
        explanation: this.generateExplanation(extractedInfo, slot, originalRequest)
      });
    });

    return plans;
  }

  async generateConflictResolution(
    eventPlans: EventPlan[],
    existingEvents: any[]
  ): Promise<ConflictResolution> {
    // TODO: Implement conflict detection and resolution
    return {
      conflicts: [],
      alternatives: eventPlans.map((plan, index) => ({
        rank: index + 1,
        plan,
        score: plan.confidence,
        reasoning: `Option ${index + 1}: ${plan.explanation}`,
        tradeoffs: []
      })),
      recommendation: 'No conflicts detected. Proceed with the preferred option.'
    };
  }

  private getSystemPrompt(): string {
    return `You are an expert scheduling assistant that helps students manage their academic and personal calendars.

Your task is to extract structured scheduling information from natural language requests. Pay special attention to:

1. TIME EXPRESSIONS: "7-9pm", "2:30pm", "morning", "afternoon", "evening"
2. DAY PATTERNS: "Tu/Th", "weekdays", "every Monday", "Monday and Wednesday"  
3. DURATION: "2 hours", "30 minutes", "1.5 hours"
4. FREQUENCY: "once", "weekly", "every Tuesday", "3 times per week"
5. CONSTRAINTS: "avoid Fridays", "no mornings", "after 6pm only"
6. ACADEMIC CONTEXT: "lab", "study session", "office hours", "class"

Common student scheduling patterns:
- "Block 7–9pm Tu/Th for EE labs" = Tuesday/Thursday 7-9pm recurring
- "Study sessions 3 hours/week" = Weekly recurring, 3-hour duration, flexible timing
- "Office hours avoid Fridays" = Recurring event excluding Fridays
- "Gym time mornings before class" = Morning preference, before existing classes

Always provide helpful suggestions and ask for clarification when the request is ambiguous.`;
  }

  private getFallbackResponse(input: string): LLMResponse {
    const lowerInput = input.toLowerCase();
    
    let intent: LLMResponse['intent'] = 'UNCLEAR';
    if (lowerInput.includes('schedule') || lowerInput.includes('block') || lowerInput.includes('add')) {
      intent = 'SCHEDULE_EVENT';
    }

    return {
      intent,
      extractedInfo: {
        title: 'Event',
        duration: 120
      },
      confidence: 0.3,
      clarificationNeeded: [
        'Could you specify the preferred time?',
        'Which days of the week work best?',
        'How long should this event be?'
      ]
    };
  }

  private generateTimeSlots(extractedInfo: LLMResponse['extractedInfo'], baseDate: Date): TimeRange[] {
    const slots: TimeRange[] = [];
    const duration = extractedInfo.duration || 120;

    if (extractedInfo.preferredTimes && extractedInfo.daysOfWeek) {
      extractedInfo.preferredTimes.forEach(time => {
        extractedInfo.daysOfWeek?.forEach(day => {
          const slot = this.createSlotForDayAndTime(day, time, duration, baseDate);
          if (slot) slots.push(slot);
        });
      });
    } else if (extractedInfo.preferredTimes) {
      extractedInfo.preferredTimes.forEach(time => {
        const slot = this.createSlotForTime(time, duration, baseDate);
        if (slot) slots.push(slot);
      });
    } else if (extractedInfo.daysOfWeek) {
      extractedInfo.daysOfWeek.forEach(day => {
        const slot = this.createSlotForDay(day, '7:00 PM', duration, baseDate);
        if (slot) slots.push(slot);
      });
    } else {
      const tomorrow = new Date(baseDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(19, 0, 0, 0);
      const end = new Date(tomorrow);
      end.setMinutes(end.getMinutes() + duration);

      slots.push({
        start: tomorrow.toISOString(),
        end: end.toISOString()
      });
    }

    return slots.filter(slot => {
      if (extractedInfo.constraints?.avoidDays) {
        const dayOfWeek = new Date(slot.start).toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        return !extractedInfo.constraints.avoidDays.includes(dayOfWeek);
      }
      return true;
    });
  }

  private createSlotForDayAndTime(day: string, time: string, duration: number, baseDate: Date): TimeRange | null {
    const dayIndex = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].indexOf(day);
    if (dayIndex === -1) return null;

    const targetDate = new Date(baseDate);
    const currentDay = targetDate.getDay();
    const daysToAdd = (dayIndex - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysToAdd);

    const parsedTime = this.parseTime(time);
    if (!parsedTime) return null;

    const start = new Date(targetDate);
    start.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  private createSlotForTime(time: string, duration: number, baseDate: Date): TimeRange | null {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const parsedTime = this.parseTime(time);
    if (!parsedTime) return null;

    const start = new Date(tomorrow);
    start.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  private createSlotForDay(day: string, defaultTime: string, duration: number, baseDate: Date): TimeRange | null {
    return this.createSlotForDayAndTime(day, defaultTime, duration, baseDate);
  }

  private parseTime(timeStr: string): { hours: number; minutes: number } | null {
    const patterns = [
      /(\d{1,2}):(\d{2})\s*(am|pm)/i,
      /(\d{1,2})\s*(am|pm)/i,
      /(\d{1,2}):(\d{2})/,
      /(\d{1,2})/
    ];

    for (const pattern of patterns) {
      const match = timeStr.match(pattern);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2] || '0');
        const meridiem = match[3]?.toLowerCase();

        if (meridiem === 'pm' && hours !== 12) {
          hours += 12;
        } else if (meridiem === 'am' && hours === 12) {
          hours = 0;
        } else if (!meridiem && hours < 8) {
          hours += 12; // assume PM for single digit hours < 8
        }

        return { hours, minutes };
      }
    }

    return null;
  }

  private generateExplanation(extractedInfo: LLMResponse['extractedInfo'], slot: TimeRange, originalRequest: string): string {
    const explanations = [
      `Scheduled "${extractedInfo.title}" based on your request`
    ];

    if (extractedInfo.daysOfWeek?.length) {
      explanations.push(`on ${extractedInfo.daysOfWeek.join(', ')}`);
    }

    if (extractedInfo.preferredTimes?.length) {
      explanations.push(`at your preferred time of ${extractedInfo.preferredTimes[0]}`);
    }

    const start = new Date(slot.start);
    const end = new Date(slot.end);
    explanations.push(`(${start.toLocaleTimeString()} - ${end.toLocaleTimeString()})`);

    if (extractedInfo.constraints?.avoidDays?.length) {
      explanations.push(`while avoiding ${extractedInfo.constraints.avoidDays.join(', ')}`);
    }

    return explanations.join(' ') + '.';
  }
}