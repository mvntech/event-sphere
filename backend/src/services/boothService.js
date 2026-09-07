const Booth = require('../models/Booth');
const ApiError = require('../utils/ApiError');

/**
 * do two axis-aligned rectangles share any area?
 *
 * treated as half-open intervals: a booth at x=0 width=2 occupies cells 0 and
 * 1, so a booth starting at x=2 sits flush against it without overlapping.
 */
function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Keeps a booth inside the expo's grid, so nothing can be dragged off-canvas. */
function assertWithinGrid(booth, floorPlanConfig) {
  const { gridWidth, gridHeight } = floorPlanConfig;

  if (booth.x + booth.width > gridWidth || booth.y + booth.height > gridHeight) {
    throw ApiError.badRequest(
      `Booth "${booth.label}" falls outside the ${gridWidth}×${gridHeight} floor plan. Move or resize it to fit.`,
      [{ field: 'x', message: 'Outside the floor plan' }]
    );
  }
}

/**
 * rejects a booth that would overlap another in the same expo.
 *
 * returns a 409 naming the conflicting booth so the frontend can highlight it
 * inline rather than failing silently.
 *
 * @param {object} candidate    {x, y, width, height, label}
 * @param {Array}  others       booths to test against
 */
function assertNoOverlap(candidate, others) {
  const clash = others.find((other) => rectsOverlap(candidate, other));

  if (clash) {
    throw ApiError.conflict(
      `Booth "${candidate.label}" overlaps booth "${clash.label}". Move one of them and try again.`,
      [
        {
          field: 'position',
          message: `Overlaps "${clash.label}"`,
          conflictingBoothId: String(clash._id ?? clash.id ?? ''),
          conflictingBoothLabel: clash.label,
        },
      ]
    );
  }
}

/**
 * validates one booth against every other booth in its expo.
 * `excludeId` skips the booth being edited, so it never collides with itself.
 */
async function assertPlaceable(candidate, expo, excludeId = null) {
  assertWithinGrid(candidate, expo.floorPlanConfig);

  const query = { expoRef: expo._id };
  if (excludeId) query._id = { $ne: excludeId };

  const others = await Booth.find(query).select('x y width height label').lean();
  assertNoOverlap(candidate, others);
}

/**
 * validates a whole layout in one pass — used by the bulk save the drag-and-drop
 * builder posts. Every pair is checked, so a layout can never be saved
 * half-valid.
 */
function assertLayoutValid(booths, floorPlanConfig) {
  const seenLabels = new Set();

  booths.forEach((booth) => {
    assertWithinGrid(booth, floorPlanConfig);

    const key = booth.label.trim().toLowerCase();
    if (seenLabels.has(key)) {
      throw ApiError.conflict(`Two booths are both labelled "${booth.label}". Labels must be unique.`, [
        { field: 'label', message: 'Duplicate label' },
      ]);
    }
    seenLabels.add(key);
  });

  for (let i = 0; i < booths.length; i += 1) {
    for (let j = i + 1; j < booths.length; j += 1) {
      if (rectsOverlap(booths[i], booths[j])) {
        throw ApiError.conflict(
          `Booth "${booths[i].label}" overlaps booth "${booths[j].label}". Move one of them and try again.`,
          [
            {
              field: 'position',
              message: `"${booths[i].label}" overlaps "${booths[j].label}"`,
              conflictingBoothLabel: booths[j].label,
            },
          ]
        );
      }
    }
  }
}

module.exports = { rectsOverlap, assertNoOverlap, assertWithinGrid, assertPlaceable, assertLayoutValid };
