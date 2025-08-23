import { RAGService } from '@/modules/rag';

describe('RAG Service Tests', () => {
  let ragService: RAGService;

  beforeEach(() => {
    ragService = new RAGService();
  });

  test('should extract course information from text', async () => {
    const mockDocs = [
      {
        pageContent: 'Course: CS 101 Introduction to Computer Science Instructor: Dr. Smith Semester: Fall 2024',
        metadata: { pageNumber: 1 }
      }
    ];

    const courseInfo = await (ragService as any).extractCourseInfo(mockDocs);
    
    expect(courseInfo.name).toBe('CS 101');
    expect(courseInfo.instructor).toBe('Dr. Smith');
    expect(courseInfo.semester).toBe('Fall 2024');
  });

  test('should parse dates correctly', () => {
    const dateStr = 'January 15, 2024';
    const parsedDate = (ragService as any).parseDate(dateStr);
    
    expect(parsedDate).toBeInstanceOf(Date);
    expect(parsedDate?.getFullYear()).toBe(2024);
    expect(parsedDate?.getMonth()).toBe(0); // January is 0
    expect(parsedDate?.getDate()).toBe(15);
  });

  test('should extract events from text', async () => {
    const mockDocs = [
      {
        pageContent: 'Midterm Exam on March 15, 2024. Final Project due April 30, 2024.',
        metadata: { pageNumber: 1 }
      }
    ];

    const events = await (ragService as any).extractEvents(mockDocs, null);
    
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('exam');
    expect(events[0].title).toContain('Midterm');
  });

  test('should calculate confidence scores', () => {
    const match = 'Midterm Exam on March 15, 2024';
    const confidence = (ragService as any).calculateEventConfidence(match, 'exam');
    
    expect(confidence).toBeGreaterThan(0.5);
    expect(confidence).toBeLessThanOrEqual(0.95);
  });

  test('should remove duplicate events', () => {
    const events = [
      { id: '1', title: 'Test', date: '2024-01-15', type: 'exam', confidence: 0.8, sourceText: 'test' },
      { id: '2', title: 'Test', date: '2024-01-15', type: 'exam', confidence: 0.8, sourceText: 'test' }
    ];

    const uniqueEvents = (ragService as any).removeDuplicateEvents(events);
    
    expect(uniqueEvents.length).toBe(1);
  });
});
