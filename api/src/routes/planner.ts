import { Router, Request, Response, NextFunction } from 'express';
import { PlannerService } from '@/modules/planner';
import { LLMOrchestratorService } from '@/modules/llm';
import { SchedulingRequest } from '@/types/events';
import { createError } from '@/middleware/error';

const router = Router();
const plannerService = new PlannerService();
const llmService = new LLMOrchestratorService();

router.post('/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { naturalLanguageInput, userId } = req.body;

    if (!naturalLanguageInput || !userId) {
      throw createError('Missing required fields: naturalLanguageInput, userId', 400);
    }

    const request: SchedulingRequest = {
      userId,
      naturalLanguageInput,
      context: req.body.context
    };

    let eventPlans;
    let llmAnalysis;

    try {
      // Use basic planner for now (LLM integration can be added later)
      eventPlans = await plannerService.createEventPlan(request);
      
      // Try LLM analysis for additional insights (optional)
      try {
        llmAnalysis = await llmService.analyzeRequest(request);
      } catch (llmError) {
        console.warn('LLM service unavailable:', llmError);
        llmAnalysis = null;
      }
    } catch (error) {
      console.error('Planning service error:', error);
      // Fallback to basic planner
      eventPlans = await plannerService.createEventPlan(request);
      llmAnalysis = null;
    }

    res.json({
      success: true,
      data: {
        plans: eventPlans,
        originalInput: naturalLanguageInput,
        timestamp: new Date().toISOString(),
        llmAnalysis: llmAnalysis ? {
          confidence: llmAnalysis.confidence,
          intent: llmAnalysis.intent,
          clarificationNeeded: llmAnalysis.clarificationNeeded,
          suggestions: llmAnalysis.suggestions
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { eventPlan } = req.body;

    if (!eventPlan) {
      throw createError('Missing required field: eventPlan', 400);
    }

    const isValid = eventPlan.title && eventPlan.startDateTime && eventPlan.endDateTime;
    const issues = [];

    if (!eventPlan.title) issues.push('Missing event title');
    if (!eventPlan.startDateTime) issues.push('Missing start time');
    if (!eventPlan.endDateTime) issues.push('Missing end time');
    
    if (eventPlan.startDateTime && eventPlan.endDateTime) {
      const start = new Date(eventPlan.startDateTime);
      const end = new Date(eventPlan.endDateTime);
      if (start >= end) issues.push('End time must be after start time');
    }

    res.json({
      success: true,
      data: {
        isValid,
        issues,
        eventPlan
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;