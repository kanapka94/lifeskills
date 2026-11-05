import { describe, expect, it } from 'vitest';
import { checkLoginAllowed, clearLoginFailures, recordLoginFailure } from './rate-limit';

describe('login attempt limit', () => {
	it('blocks an IP for 15 minutes after three failed attempts', () => {
		const ip = `test-${crypto.randomUUID()}`;
		const now = Date.now();

		expect(checkLoginAllowed(ip, now).allowed).toBe(true);

		recordLoginFailure(ip, now);
		recordLoginFailure(ip, now);

		const third = recordLoginFailure(ip, now);
		expect(third.allowed).toBe(false);

		if (!third.allowed) {
			expect(third.retryAfterSeconds).toBe(15 * 60);
		}

		const afterFourteenMinutes = checkLoginAllowed(ip, now + 14 * 60 * 1000);
		expect(afterFourteenMinutes.allowed).toBe(false);

		const afterFifteenMinutes = checkLoginAllowed(ip, now + 15 * 60 * 1000);
		expect(afterFifteenMinutes.allowed).toBe(true);
	});

	it('resets the counter after a successful login', () => {
		const ip = `test-${crypto.randomUUID()}`;
		const now = Date.now();

		recordLoginFailure(ip, now);
		recordLoginFailure(ip, now);
		clearLoginFailures(ip);

		recordLoginFailure(ip, now);
		recordLoginFailure(ip, now);

		expect(checkLoginAllowed(ip, now).allowed).toBe(true);
	});
});
