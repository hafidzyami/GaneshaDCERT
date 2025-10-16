/**
 * Logger Service
 * Centralized logging for better debugging and monitoring
 */

enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

class Logger {
  private serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? `\n${JSON.stringify(meta, null, 2)}` : "";
    return `[${timestamp}] [${level}] [${this.serviceName}] ${message}${metaString}`;
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage(LogLevel.INFO, message, meta));
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, meta));
  }

  error(message: string, error?: any): void {
    const errorMeta = error
      ? {
          message: error.message,
          stack: error.stack,
          ...(error.response && { response: error.response.data }),
        }
      : undefined;
    console.error(this.formatMessage(LogLevel.ERROR, message, errorMeta));
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }
}

export default Logger;
