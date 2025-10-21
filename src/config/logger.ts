import { env } from './env';

/**
 * Logger Service
 * Simple logger with different levels and colored output
 */

enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = env.NODE_ENV === 'development';
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  private getIcon(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR:
        return '❌';
      case LogLevel.WARN:
        return '⚠️';
      case LogLevel.INFO:
        return 'ℹ️';
      case LogLevel.DEBUG:
        return '🔍';
      default:
        return '';
    }
  }

  error(message: string, error?: any): void {
    const icon = this.getIcon(LogLevel.ERROR);
    console.error(`${icon} ${this.formatMessage(LogLevel.ERROR, message, error)}`);
  }

  warn(message: string, meta?: any): void {
    const icon = this.getIcon(LogLevel.WARN);
    console.warn(`${icon} ${this.formatMessage(LogLevel.WARN, message, meta)}`);
  }

  info(message: string, meta?: any): void {
    const icon = this.getIcon(LogLevel.INFO);
    console.log(`${icon} ${this.formatMessage(LogLevel.INFO, message, meta)}`);
  }

  debug(message: string, meta?: any): void {
    if (this.isDevelopment) {
      const icon = this.getIcon(LogLevel.DEBUG);
      console.log(`${icon} ${this.formatMessage(LogLevel.DEBUG, message, meta)}`);
    }
  }

  success(message: string, meta?: any): void {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
    console.log(`✅ [${timestamp}] ${message}${metaStr}`);
  }

  http(method: string, url: string, statusCode: number, duration: number): void {
    const timestamp = new Date().toISOString();
    const icon = statusCode >= 400 ? '❌' : '✅';
    console.log(`${icon} [${timestamp}] [HTTP] ${method} ${url} - ${statusCode} (${duration}ms)`);
  }
}

export default new Logger();
