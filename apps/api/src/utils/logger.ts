type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, meta?: LogMeta): string {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
}

export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, meta));
    }
  },
  info(message: string, meta?: LogMeta): void {
    console.info(formatMessage('info', message, meta));
  },
  warn(message: string, meta?: LogMeta): void {
    console.warn(formatMessage('warn', message, meta));
  },
  error(message: string, meta?: LogMeta): void {
    console.error(formatMessage('error', message, meta));
  },
};
