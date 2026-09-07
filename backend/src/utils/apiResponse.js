function normalizeIds(value, seen = new WeakSet()) {
  if (Array.isArray(value)) return value.map((item) => normalizeIds(item, seen));

  // only plain objects: leave Dates, Buffers, ObjectIds and class instances alone.
  const isPlain =
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

  if (!isPlain) return value;

  // guard against a cycle in a populated graph.
  if (seen.has(value)) return value;
  seen.add(value);

  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = normalizeIds(item, seen);
  }

  if (out._id !== undefined && out.id === undefined) out.id = String(out._id);

  return out;
}

/** every API response follows { success, data, message } */
function ok(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, data: normalizeIds(data), message });
}

function created(res, data = null, message = 'Created') {
  return ok(res, data, message, 201);
}

module.exports = { ok, created, normalizeIds };
