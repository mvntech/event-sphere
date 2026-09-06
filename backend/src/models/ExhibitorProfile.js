const mongoose = require('mongoose');

const APPROVAL_STATUSES = ['pending', 'approved', 'rejected'];

const assetSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    filename: { type: String, required: true, maxlength: 260 },
    mimeType: { type: String, required: true },
    bytes: { type: Number, required: true },
    resourceType: { type: String, default: 'raw' },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },
    description: { type: String, trim: true, maxlength: 600, default: '' },
  },
  { _id: true }
);

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    role: { type: String, trim: true, maxlength: 80, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
  },
  { _id: true }
);

const exhibitorProfileSchema = new mongoose.Schema(
  {
    userRef: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },

    companyName: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    category: { type: String, required: true, trim: true, maxlength: 80, index: true },

    logoUrl: { type: String, default: null },
    logoPublicId: { type: String, default: null, select: false },
    documents: { type: [assetSchema], default: [] },

    products: { type: [productSchema], default: [] },
    staff: { type: [staffSchema], default: [] },

    contact: {
      email: { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
      phone: { type: String, trim: true, maxlength: 40, default: '' },
      website: { type: String, trim: true, maxlength: 300, default: '' },
    },

    approvalStatus: { type: String, enum: APPROVAL_STATUSES, default: 'pending', index: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    // shown back to the exhibitor so a rejection is actionable, not a dead end.
    reviewNote: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.logoPublicId;
        return ret;
      },
    },
  }
);

// one application per exhibitor per expo — the DB, not just the controller, enforces it.
exhibitorProfileSchema.index({ userRef: 1, expoRef: 1 }, { unique: true });
// the organizer's application queue: "pending applications for this expo, oldest first".
exhibitorProfileSchema.index({ expoRef: 1, approvalStatus: 1, createdAt: 1 });
// keyword search across the directory. Product names and categories are
// included so an attendee searching "picking arm" finds the company selling one
exhibitorProfileSchema.index(
  {
    companyName: 'text',
    description: 'text',
    category: 'text',
    'products.name': 'text',
    'products.category': 'text',
    'products.description': 'text',
  },
  {
    name: 'exhibitor_search',
    weights: { companyName: 10, category: 6, 'products.name': 6, 'products.category': 4, description: 2, 'products.description': 1 },
  }
);

const ExhibitorProfile = mongoose.model('ExhibitorProfile', exhibitorProfileSchema);
ExhibitorProfile.APPROVAL_STATUSES = APPROVAL_STATUSES;

module.exports = ExhibitorProfile;
