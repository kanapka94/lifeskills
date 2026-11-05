/**
 * All game math in one place.
 *
 * This way the UI doesn't need to know where XP comes from — it receives
 * ready-made numbers from this module. Later we'll add multipliers for Toggl
 * tags here (e.g. #technique = +20% XP).
 */

/** 1 minute of practice = 10 XP. */
export const XP_PER_MINUTE = 10;

/** How many seconds are needed for 1 XP (60 s / 10 XP). */
export const SECONDS_PER_XP = 60 / XP_PER_MINUTE;

/**
 * Converts Toggl seconds to XP.
 * We round down to whole XP — we don't want fractions in the progress bar.
 */
export function secondsToXp(totalSeconds: number): number {
	if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
		return 0;
	}

	return Math.floor(totalSeconds / SECONDS_PER_XP);
}

/**
 * How much XP is needed to advance from `level` to `level + 1`.
 *
 * Level 1 -> 2: 100 XP (10 minutes)
 * Level 2 -> 3: 150 XP
 * Level 3 -> 4: 200 XP
 */
export function xpToNextLevel(level: number): number {
	const safeLevel = Math.max(1, Math.floor(level));
	return 100 + (safeLevel - 1) * 50;
}

/**
 * Total XP needed to reach a given level.
 *
 * This is the sum of the sequence: 100 + 150 + 200 + ...
 * Level 1 = 0 XP
 * Level 2 = 100 XP
 * Level 3 = 250 XP
 * Level 4 = 450 XP
 */
export function totalXpForLevel(level: number): number {
	const safeLevel = Math.max(1, Math.floor(level));
	return 25 * (safeLevel - 1) * (safeLevel + 2);
}

export type LevelProgress = {
	level: number;
	totalXp: number;
	xpIntoLevel: number;
	xpForNextLevel: number;
	xpToNextLevel: number;
	/** Value from 0 to 1 — ready for the progress bar. */
	progress: number;
};

/**
 * Calculates the level and progress within the current level based on total XP.
 */
export function getLevelProgress(totalXp: number): LevelProgress {
	const xp = Math.max(0, Math.floor(totalXp));

	let level = 1;
	while (totalXpForLevel(level + 1) <= xp) {
		level += 1;
	}

	const currentLevelXp = totalXpForLevel(level);
	const nextLevelXp = totalXpForLevel(level + 1);
	const xpIntoLevel = xp - currentLevelXp;
	const xpForNextLevel = nextLevelXp - currentLevelXp;

	return {
		level,
		totalXp: xp,
		xpIntoLevel,
		xpForNextLevel,
		xpToNextLevel: nextLevelXp - xp,
		progress: xpForNextLevel === 0 ? 1 : xpIntoLevel / xpForNextLevel
	};
}
