const mongoose = require('mongoose');

const STATUSES = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];

const expoSchema = new mongoose.Schema(
  {
    organizerRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    theme: { type: String, trim: true, maxlength: 120, default: '' },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'draft', index: true },

    // grid the Phase 3 floor-plan builder lays booths out on.
    floorPlanConfig: {
      gridWidth: { type: Number, default: 20, min: 4, max: 60 },
      gridHeight: { type: Number, default: 14, min: 4, max: 60 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// public browsing hits "published expos, soonest first"
expoSchema.index({ status: 1, startDate: 1 });
expoSchema.index({ organizerRef: 1, startDate: -1 });
// keyword search across the fields the attendee directory will query.
expoSchema.index({ title: 'text', description: 'text', theme: 'text', location: 'text' });

expoSchema.pre('validate', function enforceDateOrder(next) {
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be on or after the start date');
  }
  next();
});

/** true while the expo is visible to attendees and exhibitors. */
expoSchema.virtual('isPublic').get(function isPublic() {
  return ['published', 'ongoing', 'completed'].includes(this.status);
});

const Expo = mongoose.model('Expo', expoSchema);
Expo.STATUSES = STATUSES;

module.exports = Expo;
