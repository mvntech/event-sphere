const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    threadRef: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageThread', required: true, index: true },
    senderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null },

    body: { type: String, required: true, trim: true, maxlength: 4000 },

    /** users who have opened the thread since this arrived. */
    readBy: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
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

// paging one conversation, oldest to newest.
messageSchema.index({ threadRef: 1, createdAt: 1 });
// counting a user's unread messages across every thread.
messageSchema.index({ threadRef: 1, readBy: 1 });

module.exports = mongoose.model('Message', messageSchema);
