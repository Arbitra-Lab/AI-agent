/**
 * Minimal shared logger. Swap for pino/winston in a follow-up issue
 * if structured logging is needed.
 */
type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, message: string): void {
  const line = `[arbitra] [${level}] ${message}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
};
