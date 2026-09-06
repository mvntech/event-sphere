const mongoose = require('mongoose');

/** every in-app notification the system raises */
const NOTIFICATION_TYPES = [
  'exhibitor-approved',
  'exhibitor-rejected',
  'booth-reserved',
  'booth-assigned',
  'session-reminder',
  'schedule-changed',
  'message',
  'feedback',
];

const notificationSchema = new mongoose.Schema(
  {
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, trim: true, maxlength: 300 },

    /** where the bell should send the user when they click through. */
    link: { type: String, trim: true, maxlength: 200, default: '' },
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null },

    read: { type: Boolean, default: false },
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

// "my unread notifications, newest first" — what the bell polls on open.
notificationSchema.index({ userRef: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
Notification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

module.exports = Notification;
