import {
	COOKIE_SECURE,
	DATABASE_PATH,
	SESSION_SECRET,
	SYNC_INTERVAL_MINUTES,
	TOGGL_API_TOKEN,
	TOGGL_START_DATE
} from '$app/env/private';

/**
 * All environment variables in one place.
 *
 * `$app/env/private` is a server-only module — SvelteKit won't allow
 * importing it into a client component. Validation and defaults live in
 * `src/env.ts`.
 */
export const runtimeEnv = {
	sessionSecret: SESSION_SECRET,
	databasePath: DATABASE_PATH,
	togglApiToken: TOGGL_API_TOKEN,
	togglStartDate: TOGGL_START_DATE,
	syncIntervalMinutes: SYNC_INTERVAL_MINUTES,
	cookieSecure: COOKIE_SECURE
};
