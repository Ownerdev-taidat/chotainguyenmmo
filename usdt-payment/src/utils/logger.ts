// ===== FILE: src/utils/logger.ts =====

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

const CURRENT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

function formatTs(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, module: string, message: string, data?: any) {
  if (LOG_LEVELS[level] < LOG_LEVELS[CURRENT_LEVEL]) return;

  const prefix = `[${formatTs()}] [${level.toUpperCase()}] [${module}]`;
  const line = data
    ? `${prefix} ${message} ${JSON.stringify(data)}`
    : `${prefix} ${message}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (module: string, msg: string, data?: any) => log('debug', module, msg, data),
  info: (module: string, msg: string, data?: any) => log('info', module, msg, data),
  warn: (module: string, msg: string, data?: any) => log('warn', module, msg, data),
  error: (module: string, msg: string, data?: any) => log('error', module, msg, data),
};
