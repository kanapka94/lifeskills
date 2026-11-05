import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Environment variable definitions (new SvelteKit 3 API).
 *
 * Each variable has a validator that runs when the app starts. This way,
 * instead of checking for `undefined` throughout the code, we get correctly
 * typed values from `$app/env/private` right away.
 */
export const variables = defineEnvVars({
	SESSION_SECRET: {
		description: 'HMAC secret for signing session cookies (min. 32 chars).',
		schema: (value) => {
			const secret = value?.trim();

			if (!secret) {
				throw new Error('Brak SESSION_SECRET w .env. Wygeneruj go: openssl rand -hex 32');
			}

			if (secret.length < 32) {
				throw new Error(
					'SESSION_SECRET musi mieć co najmniej 32 znaki. Wygeneruj go: openssl rand -hex 32'
				);
			}

			return secret;
		}
	},

	DATABASE_PATH: {
		description: 'Path to the SQLite file.',
		schema: (value) => value?.trim() || 'data/lifeexp.db'
	},

	TOGGL_API_TOKEN: {
		description: 'Toggl Track token. Empty = integration disabled.',
		schema: (value) => value?.trim() || ''
	},

	TOGGL_START_DATE: {
		description: 'Start of XP history (YYYY-MM-DD). Empty = last 12 months.',
		schema: (value) => value?.trim() || ''
	},

	SYNC_INTERVAL_MINUTES: {
		description: 'Minimum interval between Toggl syncs (minutes).',
		schema: (value) => {
			const parsed = Number(value);
			return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
		}
	},

	COOKIE_SECURE: {
		description: 'Whether to send the session cookie only over HTTPS.',
		schema: (value) =>
			value === undefined ? process.env.NODE_ENV === 'production' : value === 'true'
	}
});
