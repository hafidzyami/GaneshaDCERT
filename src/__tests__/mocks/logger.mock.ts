/**
 * Logger Mock for Testing
 * Suppresses console output and tracks log calls
 */

// Track log calls
const logCalls = {
  debug: [] as any[],
  info: [] as any[],
  warn: [] as any[],
  error: [] as any[],
  success: [] as any[],
};

/**
 * Clear all log calls
 */
export function clearMockLogger(): void {
  Object.keys(logCalls).forEach((key) => {
    (logCalls as any)[key] = [];
  });
}

/**
 * Get all log calls
 */
export function getLogCalls(): typeof logCalls {
  return logCalls;
}

/**
 * Mock Logger
 */
export const mockLogger = {
  debug: jest.fn((...args: any[]) => {
    logCalls.debug.push(args);
  }),

  info: jest.fn((...args: any[]) => {
    logCalls.info.push(args);
  }),

  warn: jest.fn((...args: any[]) => {
    logCalls.warn.push(args);
  }),

  error: jest.fn((...args: any[]) => {
    logCalls.error.push(args);
  }),

  success: jest.fn((...args: any[]) => {
    logCalls.success.push(args);
  }),
};

export default mockLogger;
