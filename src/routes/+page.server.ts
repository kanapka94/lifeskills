import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/app-db.ts';
import { getSyncState, listSkills, type Skill } from '#lib/server/db.ts';
import { formatDuration, formatWait } from '#lib/game/format.ts';
import { getLevelProgress, secondsToXp } from '#lib/game/xp.ts';
import type { SkillView } from '#lib/types.ts';
import { runtimeEnv } from '#lib/server/runtime-env.ts';
import { SESSION_COOKIE_NAME } from '#lib/server/session.ts';
import { secondsUntilNextSync, shouldSync, syncUser } from '#lib/server/sync.ts';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/login');
	}

	const user = locals.user;
	let state = getSyncState(db, user.id);
	let autoError: string | null = null;

	// We sync automatically on page entry, but only once every
	// SYNC_INTERVAL_MINUTES. This protects the 30 requests/hour Toggl limit.
	if (
		runtimeEnv.togglApiToken &&
		shouldSync(state.last_attempt_at, runtimeEnv.syncIntervalMinutes)
	) {
		const result = await syncUser(user);
		state = getSyncState(db, user.id);
		autoError = result.error;
	}

	const skills = listSkills(db, user.id).map(toSkillView);
	const totalXp = skills.reduce((sum, skill) => sum + skill.xp, 0);
	const totalSeconds = skills.reduce((sum, skill) => sum + skill.totalSeconds, 0);

	return {
		user,
		skills,
		totalXp,
		totalTimeLabel: formatDuration(totalSeconds),
		globalProgress: getLevelProgress(totalXp),
		lastSyncedAt: state.last_synced_at,
		syncError: autoError ?? state.last_error,
		syncWarning: state.last_warning,
		togglConfigured: Boolean(runtimeEnv.togglApiToken),
		syncIntervalMinutes: runtimeEnv.syncIntervalMinutes,
		nextSyncInSeconds: secondsUntilNextSync(state.last_attempt_at, runtimeEnv.syncIntervalMinutes)
	};
};

export const actions: Actions = {
	sync: async ({ locals }) => {
		if (!locals.user) {
			redirect(303, '/login');
		}

		if (!runtimeEnv.togglApiToken) {
			return fail(400, {
				syncError: 'Brak TOGGL_API_TOKEN w pliku .env. Dodaj token z Toggl i zrestartuj serwer.',
				syncWarning: null
			});
		}

		const state = getSyncState(db, locals.user.id);

		if (!shouldSync(state.last_attempt_at, runtimeEnv.syncIntervalMinutes)) {
			const waitSeconds = secondsUntilNextSync(
				state.last_attempt_at,
				runtimeEnv.syncIntervalMinutes
			);

			return fail(429, {
				syncError: `Kolejna synchronizacja będzie możliwa za ${formatWait(waitSeconds)}.`,
				syncWarning: null
			});
		}

		const result = await syncUser(locals.user);

		if (!result.ok) {
			return fail(502, {
				syncError: result.error,
				syncWarning: result.warning
			});
		}

		return {
			syncError: null,
			syncWarning: result.warning
		};
	},

	logout: async ({ cookies }) => {
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		redirect(303, '/login');
	}
};

function toSkillView(skill: Skill): SkillView {
	const xp = secondsToXp(skill.total_seconds);

	return {
		id: skill.id,
		name: skill.name,
		color: isValidHexColor(skill.color) ? skill.color : null,
		totalSeconds: skill.total_seconds,
		totalTimeLabel: formatDuration(skill.total_seconds),
		xp,
		progress: getLevelProgress(xp)
	};
}

function isValidHexColor(value: string | null): value is string {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}
