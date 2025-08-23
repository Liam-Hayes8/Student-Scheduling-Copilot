import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
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
  private embeddings: OpenAIEmbeddings;
  private db: DatabaseService;

  constructor() {
    // Only initialize embeddings if API key is available
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'demo-key-placeholder') {
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
    }
    this.db = new DatabaseService();
  }

  async processSyllabus(fileBuffer: Buffer, userId: string): Promise<SyllabusAnalysis> {
    try {
      // Load and parse PDF
      const loader = new PDFLoader(fileBuffer as any);
      const docs = await loader.load();

      // Split into chunks for better processing
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      const splitDocs = await textSplitter.splitDocuments(docs);

      // Create vector store
      const vectorStore = await MemoryVectorStore.fromDocuments(
        splitDocs,
        this.embeddings
      );

      // Extract course information
      const courseInfo = await this.extractCourseInfo(splitDocs);

      // Extract events (exams, assignments, etc.)
      const events = await this.extractEvents(splitDocs, vectorStore);

      // Store in database for future retrieval
      await this.storeSyllabusData(userId, courseInfo, events, splitDocs);

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

  private async extractEvents(docs: Document[], vectorStore: MemoryVectorStore): Promise<SyllabusEvent[]> {
    const events: SyllabusEvent[] = [];
    const eventPatterns = [
      // Exam patterns
      { pattern: /(?:exam|test|final|midterm)\s+(?:on|date|due):\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi, type: 'exam' as const },
      { pattern: /([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s*[-–—]\s*(?:exam|test|final|midterm)/gi, type: 'exam' as const },
      
      // Assignment patterns
      { pattern: /(?:assignment|homework|hw|project)\s+(?:due|on):\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi, type: 'assignment' as const },
      { pattern: /([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s*[-–—]\s*(?:assignment|homework|hw|project)/gi, type: 'assignment' as const },
      
      // Quiz patterns
      { pattern: /(?:quiz)\s+(?:on|date):\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4})/gi, type: 'quiz' as const },
      
      // General date patterns
      { pattern: /([A-Za-z]+\s+\d{1,2},?\s+\d{4})\s*[-–—]\s*([^.\n]+)/gi, type: 'other' as const },
    ];

    for (const doc of docs) {
      const text = doc.pageContent;
      
      for (const { pattern, type } of eventPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const date = this.parseDate(match[1]);
          if (date) {
            const title = this.extractEventTitle(text, match[0], type);
            const description = this.extractEventDescription(text, match[0]);
            
            events.push({
              id: `event_${Date.now()}_${Math.random()}`,
              title,
              date: date.toISOString(),
              type,
              description,
              confidence: this.calculateEventConfidence(match[0], type),
              sourceText: match[0]
            });
          }
        }
      }
    }

    // Remove duplicates and sort by date
    const uniqueEvents = this.removeDuplicateEvents(events);
    return uniqueEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private parseDate(dateStr: string): Date | null {
    const datePatterns = [
      /([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/, // "January 15, 2024"
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // "1/15/2024"
      /(\d{1,2})-(\d{1,2})-(\d{4})/, // "1-15-2024"
    ];

    for (const pattern of datePatterns) {
      const match = dateStr.match(pattern);
      if (match) {
        if (pattern.source.includes('[A-Za-z]+')) {
          // Month name format
          const month = new Date(`${match[1]} 1, 2000`).getMonth();
          return new Date(parseInt(match[3]), month, parseInt(match[2]));
        } else {
          // Numeric format
          const month = parseInt(match[1]) - 1;
          const day = parseInt(match[2]);
          const year = parseInt(match[3]);
          return new Date(year, month, day);
        }
      }
    }

    return null;
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
    if (type === 'assignment' && /(assignment|homework|hw|project)/i.test(match)) confidence += 0.3;
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

  private async storeSyllabusData(userId: string, courseInfo: any, events: SyllabusEvent[], docs: Document[]) {
    try {
      // Store course information
      await this.db.storeCourseInfo(userId, courseInfo);

      // Store events
      for (const event of events) {
        await this.db.storeSyllabusEvent(userId, event);
      }

      // Store document chunks for future retrieval
      await this.db.storeDocumentChunks(userId, docs);

      console.log(`Stored ${events.length} events for user ${userId}`);
    } catch (error) {
      console.error('Error storing syllabus data:', error);
      // Don't throw - this is not critical for the main flow
    }
  }

  async searchSyllabus(userId: string, query: string): Promise<SyllabusEvent[]> {
    try {
      // Retrieve stored events from database
      const events = await this.db.getSyllabusEvents(userId);
      
      // Simple keyword matching for now
      const queryLower = query.toLowerCase();
      return events.filter(event => 
        event.title.toLowerCase().includes(queryLower) ||
        event.description?.toLowerCase().includes(queryLower) ||
        event.type.toLowerCase().includes(queryLower)
      );
    } catch (error) {
      console.error('Error searching syllabus:', error);
      return [];
    }
  }

  async getUpcomingEvents(userId: string, days: number = 30): Promise<SyllabusEvent[]> {
    try {
      const events = await this.db.getSyllabusEvents(userId);
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      
      return events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate >= now && eventDate <= future;
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return [];
    }
  }
}
