const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },

    title: { type: String, required: [true, 'Title is required'], trim: true, maxlength: 160 },
    speaker: { type: String, required: true, trim: true, maxlength: 120 },
    topic: { type: String, required: true, trim: true, maxlength: 120 },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },

    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },

    /** null means unlimited seats. */
    capacity: { type: Number, default: null, min: 1 },
    /**
     * denormalized seat counter. Registration takes a seat with a single
     * conditional $inc, which is what makes the capacity check race-free —
     * see services/registrationService.js.
     */
    registeredCount: { type: Number, default: 0, min: 0 },
    reminderSent: { type: Boolean, default: false },
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

// the schedule view: "all sessions for this expo in time order".
sessionSchema.index({ expoRef: 1, startTime: 1 });
// the reminder job's query (§10) — due soon and not yet reminded.
sessionSchema.index({ startTime: 1, reminderSent: 1 });

sessionSchema.pre('validate', function enforceTimeOrder(next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'End time must be after the start time');
  }
  next();
});

sessionSchema.virtual('seatsRemaining').get(function seatsRemaining() {
  if (this.capacity == null) return null;
  return Math.max(this.capacity - this.registeredCount, 0);
});

sessionSchema.virtual('isFull').get(function isFull() {
  return this.capacity != null && this.registeredCount >= this.capacity;
});

module.exports = mongoose.model('Session', sessionSchema);
