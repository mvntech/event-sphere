const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['organizer', 'exhibitor', 'attendee'];
const ORGANIZER_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

/** one live refresh token (a "session"). stored hashed so a DB leak can't mint sessions. */
const sessionSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String },
    ip: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, index: true },
    avatarUrl: { type: String, default: null },
    consentGiven: { type: Boolean, required: true, default: false },
    organizerApprovalStatus: {
      type: String,
      enum: [...ORGANIZER_APPROVAL_STATUSES, null],
      default: null,
    },
    organizerReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    organizerReviewedAt: { type: Date, default: null },
    notificationPrefs: {
      email: { type: Boolean, default: true },
    },
    deletionRequestedAt: { type: Date, default: null },
    /** set when the identifying fields have been overwritten. */
    anonymizedAt: { type: Date, default: null },

    sessions: { type: [sessionSchema], default: [], select: false },

    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpires: { type: Date, default: null, select: false },
    // invalidates access tokens issued before a password change.
    passwordChangedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.sessions;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
  this.passwordChangedAt = new Date();
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** public shape returned to the client — never leaks hashes or sessions. */
userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    avatarUrl: this.avatarUrl,
    consentGiven: this.consentGiven,
    notificationPrefs: this.notificationPrefs,
    deletionRequestedAt: this.deletionRequestedAt,
    organizerApprovalStatus: this.organizerApprovalStatus,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);
User.ROLES = ROLES;
User.ORGANIZER_APPROVAL_STATUSES = ORGANIZER_APPROVAL_STATUSES;

module.exports = User;
