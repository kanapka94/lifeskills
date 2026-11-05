import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { db } from '#lib/server/app-db.ts';
import { findUserById, toPublicUser } from '#lib/server/db.ts';
import { runtimeEnv } from '#lib/server/runtime-env.ts';
import { SESSION_COOKIE_NAME, readSessionCookie } from '#lib/server/session.ts';

/**
 * Hook run on every server request.
 *
 * Does two things:
 * 1. Reads the signed session cookie and sets `event.locals.user`.
 * 2. Makes sure a logged-out visitor can't access the dashboard.
 *
 * Thanks to this, every `load` and `action` can simply check `locals.user`
 * instead of parsing the cookie again.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const rawSession = event.cookies.get(SESSION_COOKIE_NAME);
	const session = readSessionCookie(rawSession, runtimeEnv.sessionSecret);

	event.locals.user = null;

	if (session) {
		const user = findUserById(db, session.userId);

		if (user) {
			event.locals.user = toPublicUser(user);
		} else {
			// The account was deleted but the cookie is still alive — clear it.
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
		}
	}

	const isLoginPage = event.url.pathname === '/login';

	if (!event.locals.user && !isLoginPage) {
		const redirectTo = encodeURIComponent(`${event.url.pathname}${event.url.search}`);
		redirect(303, `/login?redirectTo=${redirectTo}`);
	}

	if (event.locals.user && isLoginPage) {
		redirect(303, '/');
	}

	return resolve(event);
};
