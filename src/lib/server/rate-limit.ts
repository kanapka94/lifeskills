/**
 * Simple login attempt limiter.
 *
 * 3 failed attempts from a given IP -> 15-minute block.
 *
 * We keep this in process memory because the app is local and single-user.
 * Restarting the server resets the counter. For a public deployment this
 * should be moved to a database or Redis.
 */

const MAX_FAILURES = 3;
const BLOCK_MS = 15 * 60 * 1000;

type Attempt = {
	failures: number;
	blockedUntil: number;
	lastAttempt: number;
};

const attempts = new Map<string, Attempt>();

export type LoginGate = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function checkLoginAllowed(ip: string, now = Date.now()): LoginGate {
	const entry = attempts.get(ip);
	if (!entry) {
		return { allowed: true };
	}

	if (entry.blockedUntil > now) {
		return {
			allowed: false,
			retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000)
		};
	}

	if (entry.blockedUntil > 0 && entry.blockedUntil <= now) {
		attempts.delete(ip);
	}

	return { allowed: true };
}

export function recordLoginFailure(ip: string, now = Date.now()): LoginGate {
	const entry = attempts.get(ip) ?? { failures: 0, blockedUntil: 0, lastAttempt: 0 };

	entry.failures += 1;
	entry.lastAttempt = now;

	if (entry.failures >= MAX_FAILURES) {
		entry.blockedUntil = now + BLOCK_MS;
		entry.failures = 0;
	}

	attempts.set(ip, entry);
	cleanup(now);

	return checkLoginAllowed(ip, now);
}

export function clearLoginFailures(ip: string): void {
	attempts.delete(ip);
}

function cleanup(now: number): void {
	if (attempts.size < 500) {
		return;
	}

	for (const [ip, entry] of attempts) {
		const isExpiredBlock = entry.blockedUntil <= now;
		const isOld = now - entry.lastAttempt > 60 * 60 * 1000;

		if (isExpiredBlock && isOld) {
			attempts.delete(ip);
		}
	}
}
