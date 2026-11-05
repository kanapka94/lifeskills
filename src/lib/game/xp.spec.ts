import { describe, expect, it } from 'vitest';
import { getLevelProgress, secondsToXp, totalXpForLevel, xpToNextLevel } from './xp';

describe('secondsToXp', () => {
	it('zamienia 1 minutę na 10 XP', () => {
		expect(secondsToXp(60)).toBe(10);
	});

	it('zamienia 10 minut na 100 XP', () => {
		expect(secondsToXp(600)).toBe(100);
	});

	it('ucina ułamki XP', () => {
		expect(secondsToXp(65)).toBe(10);
	});

	it('ignoruje wartości ujemne i NaN', () => {
		expect(secondsToXp(-10)).toBe(0);
		expect(secondsToXp(Number.NaN)).toBe(0);
	});
});

describe('krzywa poziomów', () => {
	it('poziom 1 zaczyna się od 0 XP', () => {
		expect(totalXpForLevel(1)).toBe(0);
	});

	it('poziom 2 wymaga 100 XP', () => {
		expect(totalXpForLevel(2)).toBe(100);
	});

	it('poziom 3 wymaga 250 XP', () => {
		expect(totalXpForLevel(3)).toBe(250);
	});

	it('każdy kolejny poziom wymaga o 50 XP więcej', () => {
		expect(xpToNextLevel(1)).toBe(100);
		expect(xpToNextLevel(2)).toBe(150);
		expect(xpToNextLevel(3)).toBe(200);
	});
});

describe('getLevelProgress', () => {
	it('0 XP to poziom 1 z pustym paskiem', () => {
		const progress = getLevelProgress(0);

		expect(progress.level).toBe(1);
		expect(progress.progress).toBe(0);
		expect(progress.xpToNextLevel).toBe(100);
	});

	it('99 XP to jeszcze poziom 1', () => {
		expect(getLevelProgress(99).level).toBe(1);
	});

	it('100 XP to poziom 2', () => {
		const progress = getLevelProgress(100);

		expect(progress.level).toBe(2);
		expect(progress.xpIntoLevel).toBe(0);
		expect(progress.xpToNextLevel).toBe(150);
	});

	it('175 XP to poziom 2 w połowie drogi do poziomu 3', () => {
		const progress = getLevelProgress(175);

		expect(progress.level).toBe(2);
		expect(progress.xpIntoLevel).toBe(75);
		expect(progress.progress).toBe(0.5);
	});

	it('250 XP to poziom 3', () => {
		expect(getLevelProgress(250).level).toBe(3);
	});
});
