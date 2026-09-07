const express = require('express');
const { health } = require('../controllers/healthController');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const expoRoutes = require('./expoRoutes');
const exhibitorRoutes = require('./exhibitorRoutes');
const sessionRoutes = require('./sessionRoutes');
const registrationRoutes = require('./registrationRoutes');
const boothRoutes = require('./boothRoutes');
const messageRoutes = require('./messageRoutes');
const notificationRoutes = require('./notificationRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const aiRoutes = require('./aiRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const { publicStats } = require('../controllers/statsController');

const router = express.Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     security: []
 *     summary: service health
 *     description: >
 *       database connection state, uptime and per-service status. mounted
 *       before the rate limiter, and used by the e2e suite to confirm the API
 *       answering on a port is the one it just started.
 *     responses:
 *       200:
 *         description: status of the API and its database
 */
router.get('/health', health);

/**
 * @openapi
 * /stats/public:
 *   get:
 *     tags: [System]
 *     security: []
 *     summary: public headline counts
 *     description: >
 *       attendee and expo totals for the marketing landing page. no
 *       authentication, and counts only — anything identifying stays behind the
 *       organizer-only analytics routes. memoised for five minutes, since this
 *       is the one endpoint an anonymous visitor hits just by loading the home
 *       page.
 *     responses:
 *       200:
 *         description: attendee and expo counts
 */
router.get('/stats/public', publicStats);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/expos', expoRoutes);
router.use('/exhibitors', exhibitorRoutes);
router.use('/sessions', sessionRoutes);
router.use('/registrations', registrationRoutes);
router.use('/booths', boothRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/ai', aiRoutes);
router.use('/analytics', analyticsRoutes);

module.exports = router;
