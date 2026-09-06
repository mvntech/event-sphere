const mongoose = require('mongoose');

const STATUSES = ['available', 'reserved', 'assigned'];

const boothSchema = new mongoose.Schema(
  {
    expoRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },

    // grid coordinates, in cells, against the expo's floorPlanConfig.
    x: { type: Number, required: true, min: 0 },
    y: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 1, max: 20 },
    height: { type: Number, required: true, min: 1, max: 20 },

    label: { type: String, required: true, trim: true, maxlength: 20 },
    status: { type: String, enum: STATUSES, default: 'available', index: true },

    /** who holds the booth. Null whenever status is 'available'. */
    exhibitorRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExhibitorProfile',
      default: null,
    },

    notes: { type: String, trim: true, maxlength: 500, default: '' },
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

// "booths for this expo, by status" — the floor plan's own query
boothSchema.index({ expoRef: 1, status: 1 });
// booth labels are how people refer to a stand, so they must be unique per expo.
boothSchema.index({ expoRef: 1, label: 1 }, { unique: true });

/** the occupied rectangle, as half-open intervals. */
boothSchema.virtual('bounds').get(function bounds() {
  return { x1: this.x, y1: this.y, x2: this.x + this.width, y2: this.y + this.height };
});

const Booth = mongoose.model('Booth', boothSchema);
Booth.STATUSES = STATUSES;

module.exports = Booth;
