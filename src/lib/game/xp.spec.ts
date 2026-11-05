import { describe, expect, it } from 'vitest';
import { getLevelProgress, secondsToXp, totalXpForLevel, xpToNextLevel } from './xp';

describe('secondsToXp', () => {
	it('converts 1 minute to 10 XP', () => {
		expect(secondsToXp(60)).toBe(10);
	});

	it('converts 10 minutes to 100 XP', () => {
		expect(secondsToXp(600)).toBe(100);
	});

	it('rounds down fractional XP', () => {
		expect(secondsToXp(65)).toBe(10);
	});

	it('ignores negative values and NaN', () => {
		expect(secondsToXp(-10)).toBe(0);
		expect(secondsToXp(Number.NaN)).toBe(0);
	});
});

describe('level curve', () => {
	it('level 1 starts at 0 XP', () => {
		expect(totalXpForLevel(1)).toBe(0);
	});

	it('level 2 requires 100 XP', () => {
		expect(totalXpForLevel(2)).toBe(100);
	});

	it('level 3 requires 250 XP', () => {
		expect(totalXpForLevel(3)).toBe(250);
	});

	it('each subsequent level requires 50 more XP', () => {
		expect(xpToNextLevel(1)).toBe(100);
		expect(xpToNextLevel(2)).toBe(150);
		expect(xpToNextLevel(3)).toBe(200);
	});
});

describe('getLevelProgress', () => {
	it('0 XP is level 1 with an empty bar', () => {
		const progress = getLevelProgress(0);

		expect(progress.level).toBe(1);
		expect(progress.progress).toBe(0);
		expect(progress.xpToNextLevel).toBe(100);
	});

	it('99 XP is still level 1', () => {
		expect(getLevelProgress(99).level).toBe(1);
	});

	it('100 XP is level 2', () => {
		const progress = getLevelProgress(100);

		expect(progress.level).toBe(2);
		expect(progress.xpIntoLevel).toBe(0);
		expect(progress.xpToNextLevel).toBe(150);
	});

	it('175 XP is level 2 halfway to level 3', () => {
		const progress = getLevelProgress(175);

		expect(progress.level).toBe(2);
		expect(progress.xpIntoLevel).toBe(75);
		expect(progress.progress).toBe(0.5);
	});

	it('250 XP is level 3', () => {
		expect(getLevelProgress(250).level).toBe(3);
	});
});
