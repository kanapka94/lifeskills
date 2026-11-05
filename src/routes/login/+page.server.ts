import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '#lib/server/app-db.ts';
import { verifyDummyPassword, verifyPassword } from '#lib/server/auth.ts';
import { findUserByUsername } from '#lib/server/db.ts';
import {
	checkLoginAllowed,
	clearLoginFailures,
	recordLoginFailure
} from '#lib/server/rate-limit.ts';
import { runtimeEnv } from '#lib/server/runtime-env.ts';
import { createSessionCookie } from '#lib/server/session.ts';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		redirect(303, '/');
	}

	return {
		redirectTo: safeRedirect(url.searchParams.get('redirectTo'))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const username = String(formData.get('username') ?? '').trim();
		const password = String(formData.get('password') ?? '');
		const redirectTo = safeRedirect(String(formData.get('redirectTo') ?? ''));
		const ip = getClientIp(event);

		// The block is checked before hashing the password so an attacker
		// can't keep loading the CPU with repeated attempts.
		const gate = checkLoginAllowed(ip);
		if (!gate.allowed) {
			return fail(429, {
				error: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${formatBlockTime(gate.retryAfterSeconds)}.`,
				username,
				redirectTo,
				retryAfterSeconds: gate.retryAfterSeconds
			});
		}

		if (!username || !password) {
			return fail(400, {
				error: 'Podaj login i hasło.',
				username,
				redirectTo
			});
		}

		const user = findUserByUsername(db, username);

		// When the login doesn't exist, we still verify a dummy hash.
		// This keeps the response time similar and doesn't reveal
		// whether an account with this login exists.
		const passwordMatches = user
			? await verifyPassword(user.password_hash, password)
			: await verifyDummyPassword(password);

		if (!user || !passwordMatches) {
			const afterFailure = recordLoginFailure(ip);

			if (!afterFailure.allowed) {
				return fail(429, {
					error: `Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za ${formatBlockTime(afterFailure.retryAfterSeconds)}.`,
					username,
					redirectTo,
					retryAfterSeconds: afterFailure.retryAfterSeconds
				});
			}

			return fail(401, {
				error: 'Nieprawidłowy login lub hasło.',
				username,
				redirectTo
			});
		}

		clearLoginFailures(ip);

		const cookie = createSessionCookie(user.id, runtimeEnv.sessionSecret, runtimeEnv.cookieSecure);
		event.cookies.set(cookie.name, cookie.value, cookie.options);

		redirect(303, redirectTo);
	}
};

/**
 * We don't trust the URL parameter. We only redirect to paths inside the app,
 * never to an external address (open redirect protection).
 */
function safeRedirect(value: string | null): string {
	if (!value || !value.startsWith('/') || value.startsWith('//')) {
		return '/';
	}

	return value;
}

function getClientIp(event: { getClientAddress: () => string }): string {
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}

function formatBlockTime(seconds: number): string {
	const minutes = Math.ceil(seconds / 60);
	return minutes <= 1 ? 'minutę' : `${minutes} min`;
}
