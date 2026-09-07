const { z } = require('zod');
const AnalyticsEvent = require('../models/AnalyticsEvent');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const recordEventSchema = z.object({
  expoRef: objectId,
  type: z.enum(AnalyticsEvent.EVENT_TYPES),
  targetRef: objectId.optional(),
});

module.exports = { recordEventSchema, objectId };
