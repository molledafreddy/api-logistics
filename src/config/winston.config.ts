import * as winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';
const logFormat = process.env.LOG_FORMAT || 'pretty';

const prettyFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const ctx = context ? `[${context}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
  }),
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
);

export const winstonConfig = {
  level: process.env.LOG_LEVEL || 'debug',
  format: isProduction || logFormat === 'json' ? jsonFormat : prettyFormat,
  transports: [new winston.transports.Console()],
};
