const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const swaggerUi = require('swagger-ui-express');
const { spec } = require('./config/swagger');

const app = express();

// behind a proxy in production, so rate limiting and req.ip see the real client.
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);
app.disable('x-powered-by');

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = new Set([env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173']);
app.use(
  cors({
    origin(origin, callback) {
      // no origin header = same-origin, curl, or a server-to-server call.
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// NoSQL injection hardening.
app.use(mongoSanitize({ replaceWith: '_' }));

app.use(
  '/api/docs',
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(spec, {
    customSiteTitle: 'EventSphere API',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none', tagsSorter: 'alpha' },
  })
);

/** the raw document, for tooling that wants the spec rather than the UI. */
app.get('/api/docs.json', (_req, res) => res.json(spec));

app.use('/api', apiLimiter, routes);

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
