import { describe, expect, it } from 'vitest';
import { checkLoginAllowed, clearLoginFailures, recordLoginFailure } from './rate-limit';

describe('limit prób logowania', () => {
	it('blokuje IP po trzech nieudanych próbach na 15 minut', () => {
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

	it('czyści licznik po udanym logowaniu', () => {
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
