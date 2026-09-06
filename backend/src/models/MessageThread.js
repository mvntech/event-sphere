const mongoose = require('mongoose');

/**
 * attendees enquiring with exhibitors, exhibitors getting organizer support, and
 * exhibitors contacting each other.
 */
const THREAD_KINDS = ['attendee-exhibitor', 'exhibitor-organizer', 'exhibitor-exhibitor'];

const messageThreadSchema = new mongoose.Schema(
  {
    /** exactly two users. Stored sorted so a pair always maps to one thread. */
    participants: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (v) => v.length === 2 && String(v[0]) !== String(v[1]),
        message: 'A thread needs exactly two distinct participants',
      },
    },

    /**
     * the two participant ids, sorted and joined. A unique index on
     * `participants` would not work: that field is an array, so a unique
     * multikey index enforces uniqueness per *element* — which would let a user
     * hold only one thread per expo in total. this scalar key expresses what we
     * actually mean, "one thread per pair per expo".
     */
    pairKey: { type: String, required: true },

    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null, index: true },
    kind: { type: String, enum: THREAD_KINDS, required: true },
    subject: { type: String, trim: true, maxlength: 160, default: '' },

    // denormalized so the inbox renders without loading every message.
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastMessagePreview: { type: String, default: '', maxlength: 200 },
    lastSenderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
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

// "my inbox, newest first" — the query the messages list runs on every load.
messageThreadSchema.index({ participants: 1, lastMessageAt: -1 });
// one thread per pair per expo, so replying never forks the conversation.
messageThreadSchema.index({ pairKey: 1, expoRef: 1 }, { unique: true });

/** canonical participant order, so [a,b] and [b,a] resolve to the same thread. */
messageThreadSchema.statics.pairKey = function pairKey(a, b) {
  return [String(a), String(b)].sort();
};

/** the scalar form of the same pair, used by the unique index. */
messageThreadSchema.statics.pairKeyString = function pairKeyString(a, b) {
  return [String(a), String(b)].sort().join(':');
};

const MessageThread = mongoose.model('MessageThread', messageThreadSchema);
MessageThread.THREAD_KINDS = THREAD_KINDS;

module.exports = MessageThread;
