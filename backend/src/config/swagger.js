const swaggerJsdoc = require('swagger-jsdoc');
const env = require('./env');

/**
 * interactive API reference at /api/docs
 *
 * generated from JSDoc on the route files rather than maintained as a separate
 * document, so the docs move when the routes move. A hand-written API reference
 * drifts from the code within a sprint; this one cannot describe a route that
 * does not exist.
 *
 * the shared schemas below are declared once here because every response in the
 * app follows the same { success, data, message } envelope — repeating
 * that on forty routes would be noise.
 */
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'EventSphere API',
    version: '1.0.0',
    description:
      'Expo management for organizers, exhibitors and attendees.\n\n' +
      'Every response follows `{ success, data, message }`; errors add `errors[]` ' +
      'with per-field detail. Authenticate with a bearer access token — use ' +
      '`POST /auth/login`, then **Authorize** above.\n\n' +
      'Routes marked with no security requirement are public: the expo listing, ' +
      'expo detail, session and exhibitor reads, and the contact form.',
  },
  servers: [{ url: `http://localhost:${env.PORT || 5000}/api`, description: 'Local development' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Success: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object', nullable: true },
          message: { type: 'string', example: 'OK' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'email' },
                message: { type: 'string', example: 'That does not look like an email address' },
              },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'No access token, or it has expired.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Signed in, but this role may not do that.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'No such resource — or one this caller may not know exists.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      RateLimited: {
        description: 'Too many requests in the window.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'Registration, sign-in, tokens and password reset' },
    { name: 'Users', description: 'Your own profile, and the data-control endpoints' },
    { name: 'Expos', description: 'Expo CRUD; reads are public' },
    { name: 'Sessions', description: 'The schedule' },
    { name: 'Booths', description: 'Floor plan layout and reservation' },
    { name: 'Exhibitors', description: 'Applications, profiles and review' },
    { name: 'Registrations', description: 'Attendee sign-ups and bookmarks' },
    { name: 'Messages', description: 'Threads between roles' },
    { name: 'Notifications', description: 'In-app notification centre' },
    { name: 'Feedback', description: 'In-app feedback and the public contact form' },
    { name: 'Analytics', description: 'Engagement figures for organizers' },
    { name: 'AI', description: 'Gemini-backed assistance, behind a stricter limiter' },
    { name: 'System', description: 'Health' },
  ],
  security: [{ bearerAuth: [] }],
};

const spec = swaggerJsdoc({
  definition,
  apis: ['./src/routes/*.js'],
});

module.exports = { spec };
