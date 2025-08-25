import { PrismaClient } from '@prisma/client';
import { EventPlan, SchedulingRequest } from '@/types/events';

export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });
  }

  // Ensure a user row exists (useful in demo mode). Uses provided id as primary key.
  async ensureDemoUser(userId: string) {
    const email = `demo+${userId}@example.com`
    return await this.prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email,
        name: 'Demo User',
        googleId: userId
      }
    })
  }

  async createUser(userData: {
    email: string;
    name?: string;
    googleId: string;
    accessToken?: string;
    refreshToken?: string;
    tokenExpiry?: Date;
  }) {
    return await this.prisma.user.upsert({
      where: { email: userData.email },
      update: {
        name: userData.name,
        accessToken: userData.accessToken,
        refreshToken: userData.refreshToken,
        tokenExpiry: userData.tokenExpiry
      },
      create: userData
    });
  }

  async getUserById(userId: string) {
    return await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        preferences: true
      }
    });
  }

  async getUserByEmail(email: string) {
    return await this.prisma.user.findUnique({
      where: { email },
      include: {
        preferences: true
      }
    });
  }

  async updateUserPreferences(userId: string, preferences: {
    timeZone?: string;
    workingHoursStart?: string;
    workingHoursEnd?: string;
    preferredDays?: string[];
    avoidDays?: string[];
    defaultEventDuration?: number;
    breakDuration?: number;
  }) {
    return await this.prisma.userPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    });
  }

  async createAuditLog(auditData: {
    userId: string;
    action: 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT' | 'CHECK_CONFLICTS' | 'ANALYZE_REQUEST' | 'UPLOAD_SYLLABUS' | 'UPDATE_PREFERENCES';
    resourceType: string;
    resourceId?: string;
    originalRequest: string;
    extractedData?: any;
    proposedChanges?: any;
    finalResult?: any;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    errorMessage?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return await this.prisma.auditLog.create({
      data: auditData
    });
  }

  async updateAuditLog(id: string, updates: {
    status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    finalResult?: any;
    errorMessage?: string;
  }) {
    return await this.prisma.auditLog.update({
      where: { id },
      data: updates
    });
  }

  async createSchedulingSession(sessionData: {
    userId: string;
    naturalLanguageInput: string;
    llmAnalysis?: any;
    extractedConstraints?: any;
    proposedPlans?: any[];
    status: 'STARTED' | 'ANALYZING' | 'PLANNING' | 'CONFLICT_CHECK' | 'USER_REVIEW' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  }) {
    return await this.prisma.schedulingSession.create({
      data: sessionData
    });
  }

  async updateSchedulingSession(id: string, updates: {
    llmAnalysis?: any;
    extractedConstraints?: any;
    proposedPlans?: any[];
    selectedPlan?: any;
    conflictAnalysis?: any;
    alternatives?: any[];
    status?: 'STARTED' | 'ANALYZING' | 'PLANNING' | 'CONFLICT_CHECK' | 'USER_REVIEW' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
    finalCalendarEventId?: string;
    completedAt?: Date;
  }) {
    return await this.prisma.schedulingSession.update({
      where: { id },
      data: updates
    });
  }

  async uploadSyllabus(syllabusData: {
    userId: string;
    filename: string;
    originalContent: string;
    extractedDates?: any[];
  }) {
    return await this.prisma.syllabus.create({
      data: syllabusData
    });
  }

  async createSyllabusChunks(chunks: {
    syllabusId: string;
    content: string;
    chunkIndex: number;
    pageNumber?: number;
    embedding?: number[];
    metadata?: any;
  }[]) {
    // If any chunk has embeddings, use raw SQL to cast to vector safely
    const anyEmbeddings = chunks.some(c => Array.isArray(c.embedding) && c.embedding.length)
    if (!anyEmbeddings) {
      return await this.prisma.syllabusChunk.createMany({ data: chunks.map(({ embedding, ...rest }) => rest as any) })
    }

    await this.prisma.$transaction(async (p) => {
      for (const c of chunks) {
        const embStr = Array.isArray(c.embedding) ? `[${c.embedding.join(',')}]` : null
        const baseSql = 'INSERT INTO "public"."syllabus_chunks" ("id", "syllabusId", "content", "chunkIndex", "pageNumber", "embedding", "metadata", "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, '
        const sql = baseSql + (embStr ? '$5::vector' : 'NULL') + ', $' + (embStr ? '6' : '5') + ', NOW())'
        const params: any[] = [
          c.syllabusId,
          c.content,
          c.chunkIndex,
          c.pageNumber || null,
        ]
        if (embStr) params.push(embStr)
        params.push(c.metadata ?? null)
        await p.$executeRawUnsafe(sql, ...params)
      }
    })
    return { count: chunks.length }
  }

  async searchSyllabusChunks(userId: string, embedding: number[], limit: number = 5) {
    // Using raw SQL for vector similarity search
    const embeddingString = `[${embedding.join(',')}]`;
    
    const chunks = await this.prisma.$queryRaw`
      SELECT sc.*, s.filename, s.id as syllabus_id
      FROM syllabus_chunks sc
      JOIN syllabi s ON sc.syllabus_id = s.id
      WHERE s.user_id = ${userId}
        AND sc.embedding IS NOT NULL
      ORDER BY sc.embedding <-> ${embeddingString}::vector
      LIMIT ${limit}
    `;

    return chunks;
  }

  async getUserAuditLogs(userId: string, limit: number = 50, offset: number = 0) {
    return await this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async getUserSchedulingSessions(userId: string, limit: number = 20, offset: number = 0) {
    return await this.prisma.schedulingSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async getAnalytics(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [sessionCount, eventCount, errorCount] = await Promise.all([
      this.prisma.schedulingSession.count({
        where: {
          userId,
          startedAt: { gte: startDate }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          userId,
          action: 'CREATE_EVENT',
          status: 'SUCCESS',
          createdAt: { gte: startDate }
        }
      }),
      this.prisma.auditLog.count({
        where: {
          userId,
          status: 'FAILED',
          createdAt: { gte: startDate }
        }
      })
    ]);

    return {
      sessionsStarted: sessionCount,
      eventsCreated: eventCount,
      errors: errorCount,
      successRate: eventCount > 0 ? ((eventCount / (eventCount + errorCount)) * 100) : 0
    };
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  // RAG-specific methods
  async storeCourseInfo(userId: string, courseInfo: any) {
    return await this.prisma.courseInfo.upsert({
      where: { userId },
      update: courseInfo,
      create: {
        userId,
        ...courseInfo
      }
    });
  }

  async storeSyllabusEvent(userId: string, event: any) {
    // Normalize event type to Prisma enum
    const mapType = (t: any): any => {
      const s = String(t || '').toUpperCase()
      if (s.includes('EXAM') || s.includes('FINAL') || s.includes('MIDTERM') || s.includes('TEST')) return 'EXAM'
      if (s.includes('ASSIGN')) return 'ASSIGNMENT'
      if (s.includes('QUIZ')) return 'QUIZ'
      if (s.includes('PROJECT')) return 'PROJECT'
      return 'OTHER'
    }
    return await this.prisma.syllabusEvent.create({
      data: {
        userId,
        title: event.title,
        date: new Date(event.date),
        type: mapType(event.type),
        description: event.description,
        course: event.course,
        confidence: event.confidence,
        sourceText: event.sourceText
      }
    });
  }

  async storeDocumentChunks(userId: string, docs: any[]) {
    const chunks = docs.map((doc, index) => ({
      userId,
      content: doc.pageContent,
      chunkIndex: index,
      pageNumber: doc.metadata?.pageNumber || 1,
      metadata: doc.metadata
    }));

    return await this.prisma.documentChunk.createMany({
      data: chunks
    });
  }

  async getSyllabusEvents(userId: string) {
    return await this.prisma.syllabusEvent.findMany({
      where: { userId },
      orderBy: { date: 'asc' }
    });
  }

  async getCourseInfo(userId: string) {
    return await this.prisma.courseInfo.findUnique({
      where: { userId }
    });
  }

  async deleteSyllabusData(userId: string) {
    await Promise.all([
      this.prisma.syllabusEvent.deleteMany({ where: { userId } }),
      this.prisma.courseInfo.deleteMany({ where: { userId } }),
      this.prisma.documentChunk.deleteMany({ where: { userId } })
    ]);
  }
}

export const dbService = new DatabaseService();