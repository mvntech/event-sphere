/** converts a JWT-style duration ("15m", "30d", "900") to milliseconds. */
const UNITS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

module.exports = function ms(value) {
  if (typeof value === 'number') return value * 1000;
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)?$/i.exec(String(value).trim());
  if (!match) throw new Error(`Unsupported duration: ${value}`);
  const [, amount, unit = 's'] = match;
  return Number(amount) * UNITS[unit.toLowerCase()];
};
