const { dbStatus } = require('../config/db');
const env = require('../config/env');

const startedAt = Date.now();

// GET /api/health
function health(_req, res) {
  const db = dbStatus();
  const healthy = db.readyState === 1;
  const memory = process.memoryUsage();

  return res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      status: healthy ? 'ok' : 'degraded',
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
      services: {
        database: { status: healthy ? 'up' : 'down', ...db },
        api: { status: 'up' },
      },
      memory: {
        rssMb: +(memory.rss / 1024 / 1024).toFixed(1),
        heapUsedMb: +(memory.heapUsed / 1024 / 1024).toFixed(1),
      },
    },
    message: healthy ? 'All systems operational' : 'Database is not connected',
  });
}

module.exports = { health };
