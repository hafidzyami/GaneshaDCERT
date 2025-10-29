import { Request, Response, NextFunction } from "express";
import { HTTP_STATUS } from "../constants";

/**
 * Simple Rate Limiter Middleware
 * In-memory rate limiting per IP address
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const store: RateLimitStore = {};

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetTime < now) {
      delete store[key];
    }
  });
}, 60 * 60 * 1000);

export interface RateLimitOptions {
  windowMs?: number; // Time window in milliseconds
  max?: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

/**
 * Create rate limiter middleware
 */
export const rateLimit = (options: RateLimitOptions = {}) => {
  const {
    windowMs = 60 * 1000, // 15 minutes default
    max = 1000000000, // 100 requests default
    message = "Too many requests, please try again later.",
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();

    // Initialize or reset if window expired
    if (!store[key] || store[key].resetTime < now) {
      store[key] = {
        count: 0,
        resetTime: now + windowMs,
      };
    }

    // Increment counter
    store[key].count++;

    // Set rate limit headers
    res.setHeader("X-RateLimit-Limit", max.toString());
    res.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, max - store[key].count).toString()
    );
    res.setHeader(
      "X-RateLimit-Reset",
      new Date(store[key].resetTime).toISOString()
    );

    // Check if limit exceeded
    if (store[key].count > max) {
      res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
        success: false,
        message,
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
      });
      return;
    }

    // Handle response for skip options
    if (skipSuccessfulRequests || skipFailedRequests) {
      const originalSend = res.send;
      res.send = function (data): Response {
        res.send = originalSend;

        // Decrement if should skip
        const shouldSkip =
          (skipSuccessfulRequests && res.statusCode < 400) ||
          (skipFailedRequests && res.statusCode >= 400);

        if (shouldSkip && store[key]) {
          store[key].count = Math.max(0, store[key].count - 1);
        }

        return res.send(data);
      };
    }

    next();
  };
};

/**
 * Preset rate limiters
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 15 minutes
  max: 10000, // 50 requests
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 15 minutes
  max: 1000000, // 100 requests
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000, // 15 minutes
  max: 1000000, // 5 login attempts
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
});
