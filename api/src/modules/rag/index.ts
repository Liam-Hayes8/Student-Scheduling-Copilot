import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import pdf from 'pdf-parse';
import { Document } from 'langchain/document';
import { DatabaseService } from '@/modules/database';

export interface SyllabusEvent {
  id: string;
  title: string;
  date: string;
  type: 'exam' | 'assignment' | 'quiz' | 'project' | 'other';
  description?: string;
  course?: string;
  confidence: number;
  sourceText: string;
}

export interface SyllabusAnalysis {
  events: SyllabusEvent[];
  courseInfo: {
    name?: string;
    instructor?: string;
    semester?: string;
  };
  summary: string;
}

export class RAGService {
  private embeddings?: OpenAIEmbeddings;
  private db: DatabaseService;

  constructor() {
    // Only initialize embeddings if API key is available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key-placeholder') {
      try {
        this.embeddings = new OpenAIEmbeddings({
          openAIApiKey: process.env.OPENAI_API_KEY,
          model: 'text-embedding-3-small' // 1536-dim to match vector(1536)
        } as any)
      } catch (e) {
        console.warn('OpenAI embeddings initialization failed. Continuing without embeddings.', e)
        this.embeddings = undefined
      }
    }
    this.db = new DatabaseService();
  }

  async processSyllabus(fileBuffer: Buffer, userId: string, filename?: string): Promise<SyllabusAnalysis> {
    try {
      // Parse PDF buffer to text with pdf-parse
      let parsed: any = null
      try {
        parsed = await pdf(fileBuffer as any)
      } catch (e) {
        parsed = { text: '' }
      }
      const fullText: string = this.normalizePdfText(parsed?.text || '')
      const docs = [
        new Document({ pageContent: fullText, metadata: { source: filename || 'syllabus.pdf', pages: parsed?.numpages } })
      ]

      // Split into chunks for better processing
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const splitDocs = await textSplitter.splitDocuments(docs);

      // Create vector store if embeddings available (for local extraction heuristics)
      let vectorStore: MemoryVectorStore | undefined
      if (this.embeddings) {
        try {
          vectorStore = await MemoryVectorStore.fromDocuments(
            splitDocs,
            this.embeddings
          );
        } catch (e) {
          console.warn('Embeddings unavailable during vector store build. Continuing without vector search.', e);
          vectorStore = undefined
        }
      }

      // Extract course information
      const courseInfo = await this.extractCourseInfo(splitDocs);
      const defaultYear = this.deriveDefaultYear(courseInfo)

      // Extract events (exams, assignments, etc.)
      const events = await this.extractEvents(splitDocs, vectorStore as any, defaultYear);

      // Store in database for future retrieval
      await this.storeSyllabusData(userId, courseInfo, events, splitDocs, filename);

      return {
        events,
        courseInfo,
        summary: `Extracted ${events.length} events from syllabus`
      };
    } catch (error) {
      console.error('Error processing syllabus:', error);
      throw new Error('Failed to process syllabus');
    }
  }

  private normalizePdfText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/-\n/g, '')
      .replace(/\n+/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  }

  private async extractCourseInfo(docs: Document[]): Promise<any> {
    const fullText = docs.map(doc => doc.pageContent).join(' ');
    
    // Simple regex patterns for course info
    const courseNamePattern = /(?:course|class|subject):\s*([A-Z]{2,4}\s*\d{3,4})/i;
    const instructorPattern = /(?:instructor|professor|prof):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i;
    const semesterPattern = /(?:semester|term|quarter):\s*(fall|spring|summer|winter)\s*\d{4}/i;

    return {
      name: fullText.match(courseNamePattern)?.[1] || undefined,
      instructor: fullText.match(instructorPattern)?.[1] || undefined,
      semester: fullText.match(semesterPattern)?.[0] || undefined,
    };
  }

  private async extractEvents(docs: Document[], vectorStore: MemoryVectorStore | undefined, defaultYear?: number): Promise<SyllabusEvent[]> {
    const events: SyllabusEvent[] = [];
    const monthNames = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    const monthNameDate = new RegExp(`${monthNames}\\.?\\s+\\d{1,2}(?:,?\\s+\\d{2,4})?`, 'gi')
    const numericDate = /\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/gi
    const dotNumericDate = /\b\d{1,2}\.\d{1,2}(?:\.\d{2,4})?\b/gi

    const inferTypeFromContext = (context: string): 'exam' | 'assignment' | 'quiz' | 'project' | 'other' => {
      const c = context.toLowerCase()
      if (/(final|midterm|exam|test)\b/.test(c)) return 'exam'
      if (/\bquiz\b/.test(c)) return 'quiz'
      if (/(assignment|homework|hw|deliverable|report|essay|paper|due)\b/.test(c)) return 'assignment'
      if (/\bproject\b/.test(c)) return 'project'
      return 'other'
    }

    for (const doc of docs) {
      const text = doc.pageContent || ''
      const patterns = [monthNameDate, numericDate, dotNumericDate]
      for (const pattern of patterns) {
        pattern.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = pattern.exec(text)) !== null) {
          const raw = match[0]
          const startIdx = Math.max(0, match.index - 120)
          const endIdx = Math.min(text.length, match.index + raw.length + 120)
          const contextWindow = text.substring(startIdx, endIdx)
          // Drop ambiguous bare numeric dates without year unless context hints at an event
          const hasYear = /\d{4}/.test(raw) || /\b(\d{2})\b/.test((raw.split(/[\/-]/)[2] || ''))
          const ctxHints = /(exam|final|midterm|quiz|assignment|homework|project|due|deadline)/i.test(contextWindow)
          if (!hasYear && pattern === numericDate && !ctxHints) {
            continue
          }
          const date = this.parseDateLoose(raw, defaultYear)
          if (!date) continue
          const type = inferTypeFromContext(contextWindow)
          const title = this.extractEventTitle(text, raw, type)
          const description = this.extractEventDescription(text, raw)
          events.push({
            id: `event_${Date.now()}_${Math.random()}`,
            title,
            date: date.toISOString(),
            type,
            description,
            confidence: this.calculateEventConfidence(raw, type),
            sourceText: raw
          })
        }
      }
    }

    const uniqueEvents = this.removeDuplicateEvents(events)
    return uniqueEvents
      .filter(e => !Number.isNaN(new Date(e.date).getTime()))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }

  private parseDateLoose(dateStr: string, defaultYear?: number): Date | null {
    const monthMap: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sept: 8, sep: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11,
    }

    const ordinal = '(?:st|nd|rd|th)?'
    const monthName = new RegExp(`(${Object.keys(monthMap).join('|')})\\.?\\s+(\\d{1,2})${ordinal}(?:,?\\s+(\\d{2,4}))?`, 'i')
    const dayMonthName = new RegExp(`(\\d{1,2})${ordinal}\\s+(${Object.keys(monthMap).join('|')})\\.?(?:\\s+(\\d{2,4}))?`, 'i')
    const mmdd = /(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/i

    let year: number | undefined
    let month: number | undefined
    let day: number | undefined

    let m = dateStr.match(monthName)
    if (m) {
      month = monthMap[m[1].toLowerCase()]
      day = parseInt(m[2], 10)
      if (m[3]) {
        const y = parseInt(m[3], 10)
        year = y < 100 ? 2000 + y : y
      }
    } else {
      m = dateStr.match(dayMonthName)
      if (m) {
        day = parseInt(m[1], 10)
        month = monthMap[m[2].toLowerCase()]
        if (m[3]) {
          const y = parseInt(m[3], 10)
          year = y < 100 ? 2000 + y : y
        }
      } else {
        m = dateStr.match(mmdd)
        if (m) {
          month = parseInt(m[1], 10) - 1
          day = parseInt(m[2], 10)
          if (m[3]) {
            const y = parseInt(m[3], 10)
            year = y < 100 ? 2000 + y : y
          }
        }
      }
    }

    if (month === undefined || day === undefined) return null
    if (year === undefined) {
      year = defaultYear ?? new Date().getFullYear()
      // If the inferred date is > 6 months in the past, roll to next year
      const candidate = new Date(year, month, day)
      const now = new Date()
      const sixMonthsMs = 1000 * 60 * 60 * 24 * 30 * 6
      if ((now.getTime() - candidate.getTime()) > sixMonthsMs) {
        year += 1
      }
    }
    return new Date(year, month, day)
  }

  private deriveDefaultYear(courseInfo: any): number | undefined {
    // Try to extract a year from semester text like "Fall 2024"
    const sem = (courseInfo?.semester || '').toString()
    const y = (sem.match(/\b(20\d{2})\b/) || [])[1]
    if (y) return parseInt(y, 10)
    return undefined
  }

  private extractEventTitle(text: string, match: string, type: string): string {
    // Try to extract a meaningful title from the context
    const context = text.substring(Math.max(0, text.indexOf(match) - 100), 
                                 text.indexOf(match) + match.length + 100);
    
    // Look for keywords that might indicate the event title
    const titlePatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:exam|test|assignment|quiz|project)/i,
      /(?:exam|test|assignment|quiz|project)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
    ];

    for (const pattern of titlePatterns) {
      const titleMatch = context.match(pattern);
      if (titleMatch && titleMatch[1]) {
        return `${titleMatch[1]} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
      }
    }

    // Fallback to generic title
    return `${type.charAt(0).toUpperCase() + type.slice(1)} - ${new Date(match).toLocaleDateString()}`;
  }

  private extractEventDescription(text: string, match: string): string | undefined {
    const context = text.substring(Math.max(0, text.indexOf(match) - 200), 
                                 text.indexOf(match) + match.length + 200);
    
    // Extract a reasonable description from the context
    const sentences = context.split(/[.!?]/).filter(s => s.trim().length > 10);
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    
    return undefined;
  }

  private calculateEventConfidence(match: string, type: string): number {
    let confidence = 0.5; // base confidence

    // Higher confidence for more specific patterns
    if (type === 'exam' && /(exam|test|final|midterm)/i.test(match)) confidence += 0.3;
    if (type === 'assignment' && /(assignment|homework|hw|project|due)/i.test(match)) confidence += 0.3;
    if (type === 'quiz' && /quiz/i.test(match)) confidence += 0.3;

    // Date format confidence
    if (/\d{4}/.test(match)) confidence += 0.1;
    if (/[A-Za-z]+\s+\d{1,2}/.test(match)) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private removeDuplicateEvents(events: SyllabusEvent[]): SyllabusEvent[] {
    const seen = new Set<string>();
    return events.filter(event => {
      const key = `${event.title}_${event.date}_${event.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async storeSyllabusData(userId: string, courseInfo: any, events: SyllabusEvent[], docs: Document[], filename?: string) {
    try {
      // Ensure user exists (demo-safe)
      await (this.db as any).ensureDemoUser(userId)

      // Store course information
      await this.db.storeCourseInfo(userId, courseInfo);

      // Store events
      for (const event of events) {
        await this.db.storeSyllabusEvent(userId, event);
      }

      // Create syllabus record and chunks, computing embeddings if available
      const originalContent = docs.map(d => d.pageContent).join('\n\n')
      const syllabus = await (this.db as any).uploadSyllabus({
        userId,
        filename: filename || 'syllabus.pdf',
        originalContent,
        extractedDates: events.map(e => ({ id: e.id, title: e.title, date: e.date, type: e.type }))
      })

      if (this.embeddings) {
        try {
          const texts = docs.map(d => d.pageContent)
          const vectors = await this.embeddings.embedDocuments(texts)
          const chunks = docs.map((doc, index) => ({
            syllabusId: (syllabus as any).id,
            content: doc.pageContent,
            chunkIndex: index,
            pageNumber: doc.metadata?.pageNumber || 1,
            embedding: vectors[index],
            metadata: doc.metadata
          }))
          await (this.db as any).createSyllabusChunks(chunks)
        } catch (e) {
          console.warn('Embeddings unavailable during chunk storage. Falling back to no-embedding storage.', e)
          await (this.db as any).createSyllabusChunks(docs.map((doc: any, index: number) => ({
            syllabusId: (syllabus as any).id,
            content: doc.pageContent,
            chunkIndex: index,
            pageNumber: doc.metadata?.pageNumber || 1,
            metadata: doc.metadata
          })))
        }
      } else {
        // Fallback to storing chunks without embeddings
        await (this.db as any).createSyllabusChunks(docs.map((doc: any, index: number) => ({
          syllabusId: (syllabus as any).id,
          content: doc.pageContent,
          chunkIndex: index,
          pageNumber: doc.metadata?.pageNumber || 1,
          metadata: doc.metadata
        })))
      }

      console.log(`Stored ${events.length} events for user ${userId}`);
    } catch (error) {
      console.error('Error storing syllabus data:', error);
      // Don't throw - this is not critical for the main flow
    }
  }

  async searchSyllabus(userId: string, query: string): Promise<SyllabusEvent[]> {
    try {
      // If embeddings available, use vector search; fallback to keyword
      if (this.embeddings) {
        const qVec = await this.embeddings.embedQuery(query)
        const chunks: any[] = await (this.db as any).searchSyllabusChunks(userId, qVec, 10)
        const allEvents = await this.db.getSyllabusEvents(userId)
        const normalize = (evs: any[]): SyllabusEvent[] => evs.map((e: any) => ({
          id: e.id,
          title: e.title,
          date: e.date instanceof Date ? e.date.toISOString() : e.date,
          type: typeof e.type === 'string' ? (e.type as string).toLowerCase() as any : (e.type as any),
          description: e.description || undefined,
          course: e.course || undefined,
          confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
          sourceText: e.sourceText || ''
        }))
        if (chunks?.length) {
          const topContent = chunks.map(c => (c.content || '')).join('\n')
          const matched = allEvents.filter(e =>
            e.title.toLowerCase().includes(query.toLowerCase()) ||
            (e.description || '').toLowerCase().includes(query.toLowerCase()) ||
            topContent.includes(e.sourceText || '')
          )
          return matched.length ? normalize(matched) : normalize(allEvents.slice(0, 5))
        }
        return normalize(allEvents.slice(0, 5))
      }

      const events = await this.db.getSyllabusEvents(userId)
      const queryLower = query.toLowerCase()
      const filtered = events.filter(event =>
        event.title.toLowerCase().includes(queryLower) ||
        event.description?.toLowerCase().includes(queryLower) ||
        event.type.toLowerCase().includes(queryLower)
      )
      return filtered.map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        type: typeof e.type === 'string' ? (e.type as string).toLowerCase() as any : (e.type as any),
        description: e.description || undefined,
        course: e.course || undefined,
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
        sourceText: e.sourceText || ''
      }))
    } catch (error) {
      console.error('Error searching syllabus:', error);
      return [];
    }
  }

  // Expose a helper for backend route to fetch top matching chunks
  async semanticSearchChunks(userId: string, query: string, limit: number = 5) {
    try {
      if (!this.embeddings) return []
      const qVec = await this.embeddings.embedQuery(query)
      return await (this.db as any).searchSyllabusChunks(userId, qVec, limit)
    } catch (e) {
      return []
    }
  }

  async getUpcomingEvents(userId: string, days: number = 30): Promise<SyllabusEvent[]> {
    try {
      const events = await this.db.getSyllabusEvents(userId);
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      const upcoming = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= future;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return upcoming.map((e: any) => ({
        id: e.id,
        title: e.title,
        date: e.date instanceof Date ? e.date.toISOString() : e.date,
        type: typeof e.type === 'string' ? (e.type as string).toLowerCase() as any : (e.type as any),
        description: e.description || undefined,
        course: e.course || undefined,
        confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
        sourceText: e.sourceText || ''
      }))
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return [];
    }
  }
}

// Test-only helper to validate date parsing without needing a real PDF or DB
export function __test_parseDateLoose(dateStr: string, defaultYear?: number): string | null {
  const svc = new RAGService()
  const d = (svc as any).parseDateLoose(dateStr, defaultYear) as Date | null
  return d ? d.toISOString().slice(0, 10) : null
}
