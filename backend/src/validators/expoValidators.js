const { z } = require('zod');
const Expo = require('../models/Expo');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Not a valid id');

const dateString = z
  .string()
  .min(1, 'Required')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Enter a valid date')
  .transform((v) => new Date(v));

const baseExpo = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
  description: z.string().trim().min(20, 'Give attendees at least a couple of sentences').max(4000),
  theme: z.string().trim().max(120).optional().default(''),
  location: z.string().trim().min(3, 'Where is it happening?').max(200),
  startDate: dateString,
  endDate: dateString,
  status: z.enum(Expo.STATUSES).optional(),
  floorPlanConfig: z
    .object({
      gridWidth: z.coerce.number().int().min(4).max(60),
      gridHeight: z.coerce.number().int().min(4).max(60),
    })
    .optional(),
};

const datesInOrder = (v) =>
  !v.startDate || !v.endDate || v.endDate >= v.startDate;

const createExpoSchema = z
  .object(baseExpo)
  .refine(datesInOrder, { path: ['endDate'], message: 'End date must be on or after the start date' });

const updateExpoSchema = z
  .object(baseExpo)
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' })
  .refine(datesInOrder, { path: ['endDate'], message: 'End date must be on or after the start date' });

const listExposQuery = z.object({
  status: z.enum(Expo.STATUSES).optional(),
  search: z.string().trim().max(140).optional(),
  mine: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

module.exports = { createExpoSchema, updateExpoSchema, listExposQuery, objectId };
