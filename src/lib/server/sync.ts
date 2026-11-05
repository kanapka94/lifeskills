import { db } from './app-db';
import {
	deactivateMissingSkills,
	getSyncState,
	listSkills,
	saveSyncError,
	saveSyncSuccess,
	setTogglWorkspaceId,
	upsertSkill,
	type PublicUser,
	type Skill
} from './db';
import { runtimeEnv } from './runtime-env';
import { getMe, getProjectTotals, getProjects, resolveHistoryStart } from './toggl';

export type SyncResult = {
	ok: boolean;
	skills: Skill[];
	lastSyncedAt: string | null;
	warning: string | null;
	error: string | null;
};

/**
 * Fetches projects and time totals from Toggl, then saves them in SQLite.
 *
 * The whole write runs in a single transaction: either we update all skills
 * or none. This way we never leave the database half-synced.
 */
export async function syncUser(user: PublicUser): Promise<SyncResult> {
	const stateBefore = getSyncState(db, user.id);
	const token = runtimeEnv.togglApiToken;

	if (!token) {
		return {
			ok: false,
			skills: listSkills(db, user.id),
			lastSyncedAt: stateBefore.last_synced_at,
			warning: null,
			error:
				'Brak TOGGL_API_TOKEN w .env. Dodaj token z Toggl (Profile Settings → API Token) i zrestartuj serwer.'
		};
	}

	try {
		const now = new Date();
		const historyStart = resolveHistoryStart(runtimeEnv.togglStartDate, now);

		const me = await getMe(token);
		const workspaceId = user.toggl_workspace_id ?? me.default_workspace_id ?? null;

		if (!workspaceId) {
			throw new Error('Toggl nie zwrócił ID workspace. Sprawdź, czy konto ma domyślny workspace.');
		}

		const projects = await getProjects(token);
		const totals = await getProjectTotals(token, workspaceId, historyStart, now);

		const save = db.transaction(() => {
			for (const project of projects) {
				upsertSkill(db, {
					userId: user.id,
					togglProjectId: project.id,
					name: project.name,
					color: project.color ?? null,
					totalSeconds: totals.totals.get(project.id) ?? 0
				});
			}

			deactivateMissingSkills(
				db,
				user.id,
				projects.map((project) => project.id)
			);

			setTogglWorkspaceId(db, user.id, workspaceId);
			saveSyncSuccess(db, user.id, totals.warning);
		});

		save();

		const stateAfter = getSyncState(db, user.id);

		return {
			ok: true,
			skills: listSkills(db, user.id),
			lastSyncedAt: stateAfter.last_synced_at,
			warning: totals.warning,
			error: null
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Nieznany błąd synchronizacji.';
		saveSyncError(db, user.id, message);

		return {
			ok: false,
			skills: listSkills(db, user.id),
			lastSyncedAt: getSyncState(db, user.id).last_synced_at,
			warning: null,
			error: message
		};
	}
}

export function secondsSince(date: string | null, now = Date.now()): number {
	if (!date) {
		return Number.POSITIVE_INFINITY;
	}

	const timestamp = new Date(date).getTime();
	if (Number.isNaN(timestamp)) {
		return Number.POSITIVE_INFINITY;
	}

	return Math.max(0, Math.floor((now - timestamp) / 1000));
}

export function secondsUntilNextSync(
	lastAttemptAt: string | null,
	intervalMinutes: number,
	now = Date.now()
): number {
	const intervalSeconds = Math.max(1, intervalMinutes) * 60;
	const elapsed = secondsSince(lastAttemptAt, now);

	if (!Number.isFinite(elapsed)) {
		return 0;
	}

	return Math.max(0, intervalSeconds - elapsed);
}

export function shouldSync(
	lastAttemptAt: string | null,
	intervalMinutes: number,
	now = Date.now()
): boolean {
	return secondsUntilNextSync(lastAttemptAt, intervalMinutes, now) === 0;
}
