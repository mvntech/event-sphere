const mongoose = require('mongoose');

const FEEDBACK_STATUSES = ['new', 'reviewed', 'resolved'];
const FEEDBACK_CATEGORIES = ['general', 'session', 'exhibitor', 'venue', 'technical'];
/**
 * where the submission came in from. the organizer inbox needs to tell a
 * signed-in user's feedback about a session apart from a stranger writing in
 * through the public contact form — they read differently and are actioned
 * differently, and without this they would be indistinguishable rows.
 */
const FEEDBACK_SOURCES = ['in-app', 'contact'];

const feedbackSchema = new mongoose.Schema(
  {
    /**
     * null for contact-form submissions: the sender has no account, which is
     * the entire point of a public contact form. anything reading this field
     * must handle null — see `source`.
     */
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    source: { type: String, enum: FEEDBACK_SOURCES, default: 'in-app', index: true },

    /** wrote in, when there is no account to look it up from. */
    contact: {
      name: { type: String, trim: true, maxlength: 120, default: '' },
      email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
    },
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null, index: true },

    content: { type: String, required: true, trim: true, maxlength: 4000 },
    /** what the submitter said it was about. */
    category: { type: String, enum: FEEDBACK_CATEGORIES, default: 'general' },
    rating: { type: Number, min: 1, max: 5, default: null },

    // filled by aiService.triageFeedback.
    aiSentiment: { type: String, enum: ['positive', 'neutral', 'negative', null], default: null },
    aiCategory: { type: String, trim: true, maxlength: 60, default: null },

    status: { type: String, enum: FEEDBACK_STATUSES, default: 'new', index: true },
    organizerNote: { type: String, trim: true, maxlength: 1000, default: '' },
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

// the organizer's inbox query: this expo's feedback, by status, newest first.
feedbackSchema.index({ expoRef: 1, status: 1, createdAt: -1 });
// the inbox also filters by where a message came from.
feedbackSchema.index({ source: 1, status: 1, createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);
Feedback.FEEDBACK_STATUSES = FEEDBACK_STATUSES;
Feedback.FEEDBACK_CATEGORIES = FEEDBACK_CATEGORIES;
Feedback.FEEDBACK_SOURCES = FEEDBACK_SOURCES;

module.exports = Feedback;
