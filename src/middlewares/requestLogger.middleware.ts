import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config';

/**
 * Request Logger Middleware
 * Logs all incoming HTTP requests with timing
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Log incoming request
  logger.debug(`Incoming ${req.method} ${req.originalUrl}`, {
    requestId: req.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body,
    query: req.query,
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (data): Response {
    res.send = originalSend;

    // Calculate duration
    const duration = Date.now() - (req.startTime || 0);

    // Log response
    logger.http(req.method, req.originalUrl, res.statusCode, duration);

    return res.send(data);
  };

  next();
};
