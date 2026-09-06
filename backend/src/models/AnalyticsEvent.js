const mongoose = require('mongoose');

/** the engagement signals the dashboard aggregates */
const EVENT_TYPES = ['boothView', 'sessionBookmark', 'profileView', 'search'];

const analyticsEventSchema = new mongoose.Schema(
  {
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    type: { type: String, enum: EVENT_TYPES, required: true },

    /**
     * what was interacted with — a booth, session or exhibitor profile.
     * left null for a search, where the query itself is the interesting part.
     */
    targetRef: { type: mongoose.Schema.Types.ObjectId, default: null },

    /** null for signed-out visitors, who still count towards traffic. */
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    /** search term, kept short and only for `search` events. */
    query: { type: String, trim: true, maxlength: 120, default: '' },
  },
  {
    // only creation matters for an append-only event log.
    timestamps: { createdAt: true, updatedAt: false },
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

// the dashboard's own query: this expo's events of a type, over a period (§6).
analyticsEventSchema.index({ expoRef: 1, type: 1, createdAt: -1 });
// ranking booths/sessions/exhibitors by how much traffic each one drew.
analyticsEventSchema.index({ expoRef: 1, type: 1, targetRef: 1 });
// de-duplicating repeat views by the same person.
analyticsEventSchema.index({ expoRef: 1, userRef: 1, type: 1, createdAt: -1 });

const AnalyticsEvent = mongoose.model('AnalyticsEvent', analyticsEventSchema);
AnalyticsEvent.EVENT_TYPES = EVENT_TYPES;

module.exports = AnalyticsEvent;
