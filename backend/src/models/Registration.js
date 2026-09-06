const mongoose = require('mongoose');

const STATUSES = ['registered', 'waitlisted', 'cancelled'];

const registrationSchema = new mongoose.Schema(
  {
    attendeeRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    /** null = registration for the expo itself rather than a specific session. */
    sessionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },

    status: { type: String, enum: STATUSES, default: 'registered', index: true },
    bookmarked: { type: Boolean, default: false },
    registeredAt: { type: Date, default: Date.now },
    cancelledAt: { type: Date, default: null },
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

// one registration row per attendee per session (and one per expo, where
// sessionRef is null). Stops double-booking at the DB level, not just in code.
registrationSchema.index({ attendeeRef: 1, expoRef: 1, sessionRef: 1 }, { unique: true });
// "my registrations" and the analytics roll-ups both read along these.
registrationSchema.index({ attendeeRef: 1, bookmarked: 1 });
registrationSchema.index({ sessionRef: 1, status: 1 });

const Registration = mongoose.model('Registration', registrationSchema);
Registration.STATUSES = STATUSES;

module.exports = Registration;
