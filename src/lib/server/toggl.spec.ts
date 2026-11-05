import { describe, expect, it } from 'vitest';
import { resolveHistoryStart, splitDateRange, toDateOnly } from './toggl';

describe('splitDateRange', () => {
	it('returns one range when it fits within the limit', () => {
		const ranges = splitDateRange(
			new Date('2025-01-01T00:00:00.000Z'),
			new Date('2025-01-10T00:00:00.000Z')
		);

		expect(ranges).toEqual([{ startDate: '2025-01-01', endDate: '2025-01-10' }]);
	});

	it('splits a long range into chunks and covers it without gaps', () => {
		const start = new Date('2024-01-01T00:00:00.000Z');
		const end = new Date('2025-12-31T00:00:00.000Z');
		const ranges = splitDateRange(start, end);

		expect(ranges.length).toBeGreaterThan(1);
		expect(ranges[0].startDate).toBe('2024-01-01');
		expect(ranges.at(-1)?.endDate).toBe('2025-12-31');

		for (let index = 1; index < ranges.length; index += 1) {
			const previousEnd = new Date(`${ranges[index - 1].endDate}T00:00:00.000Z`);
			const currentStart = new Date(`${ranges[index].startDate}T00:00:00.000Z`);
			const dayAfterPrevious = new Date(previousEnd.getTime() + 24 * 60 * 60 * 1000);

			expect(toDateOnly(dayAfterPrevious)).toBe(toDateOnly(currentStart));
		}
	});

	it('returns an empty array when the start is after the end', () => {
		expect(
			splitDateRange(new Date('2025-02-01T00:00:00.000Z'), new Date('2025-01-01T00:00:00.000Z'))
		).toEqual([]);
	});
});

describe('resolveHistoryStart', () => {
	const now = new Date('2026-11-05T12:00:00.000Z');

	it('defaults to 365 days back', () => {
		expect(toDateOnly(resolveHistoryStart(undefined, now))).toBe('2025-11-05');
	});

	it('accepts a valid date from .env', () => {
		expect(toDateOnly(resolveHistoryStart('2024-01-01', now))).toBe('2024-01-01');
	});

	it('rejects an invalid date format', () => {
		expect(() => resolveHistoryStart('01.01.2024', now)).toThrow(/YYYY-MM-DD/);
	});

	it('rejects a future date', () => {
		expect(() => resolveHistoryStart('2027-01-01', now)).toThrow(/future/);
	});
});
