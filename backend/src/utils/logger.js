const winston = require('winston');

const isProd = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'error' : 'info'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProd
      ? winston.format.json()
      : winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level.toUpperCase()} ${message}${rest}`;
        })
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
