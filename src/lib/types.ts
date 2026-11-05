import type { LevelProgress } from '#lib/game/xp.ts';

/**
 * Skill as seen by the UI. This is already computed data:
 * Toggl seconds have been converted to XP and level.
 */
export type SkillView = {
	id: number;
	name: string;
	color: string | null;
	totalSeconds: number;
	totalTimeLabel: string;
	xp: number;
	progress: LevelProgress;
};
