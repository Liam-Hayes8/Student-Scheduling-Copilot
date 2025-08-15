import { Request, Response, NextFunction } from 'express';

export interface RequestWithTiming extends Request {
  startTime?: number;
}

export const requestLogger = (req: RequestWithTiming, res: Response, next: NextFunction) => {
  req.startTime = Date.now();
  
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - (req.startTime || 0);
    
    if (process.env.ENABLE_REQUEST_LOGGING === 'true') {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};