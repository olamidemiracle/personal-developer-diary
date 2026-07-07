/**
 * Very small in-memory brute-force guard for the login endpoint.
 * Since there is exactly one account in this whole system, a locked-out
 * IP after repeated failed attempts is a meaningful protection. This is
 * intentionally simple (no Redis) — state resets if the server restarts.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

/** ip -> { count, firstAttemptAt, lockedUntil } */
const attempts = new Map();

const getClientIp = (req) => req.ip || req.connection?.remoteAddress || 'unknown';

const checkLoginRateLimit = (req, res, next) => {
  const ip = getClientIp(req);
  const record = attempts.get(ip);

  if (record?.lockedUntil && record.lockedUntil > Date.now()) {
    const secondsLeft = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      message: `Too many failed login attempts. Try again in ${secondsLeft} seconds.`,
    });
  }

  next();
};

const recordFailedAttempt = (req) => {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = attempts.get(ip) || { count: 0, firstAttemptAt: now, lockedUntil: null };

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    record.count = 0;
  }

  attempts.set(ip, record);
};

const clearAttempts = (req) => {
  attempts.delete(getClientIp(req));
};

module.exports = { checkLoginRateLimit, recordFailedAttempt, clearAttempts };
