// /scripts/api/utils/logger.ts
import pino, { type LoggerOptions } from 'pino';
import { ENV } from './http'; // Assuming ENV is exported from http.ts

const logLevel = ENV('VITE_LOG_LEVEL', 'info');

const options: LoggerOptions = {
  level: logLevel,
  // Browser-specific configuration for pino
  browser: {
    asObject: true, // Logs as objects
    // You might want to transmit logs to a server in a real app,
    // but for now, it will log to the browser console.
  },
};

// In non-browser environments, you might want different transports
// For example, pretty-printing in development with Node.js:
/*
if (typeof window === 'undefined' && ENV('NODE_ENV', 'development') === 'development') {
  options.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
}
*/

export const log = pino(options);