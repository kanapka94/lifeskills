import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Session without a database table.
 *
 * The cookie contains: userId.expiresAt.signature
 * The signature is HMAC-SHA256 with SESSION_SECRET. The client can't replace
 * userId because it doesn't know the secret.
 */

export const SESSION_COOKIE_NAME = 'lifeexp_session';

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
	userId: number;
	expiresAt: number;
};

export type SessionCookieOptions = {
	path: string;
	httpOnly: boolean;
	sameSite: 'strict';
	secure: boolean;
	maxAge: number;
};

export type SessionCookie = {
	name: string;
	value: string;
	options: SessionCookieOptions;
};

function sign(value: string, secret: string): string {
	return createHmac('sha256', secret).update(value).digest('base64url');
}

function signaturesMatch(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a);
	const bBuffer = Buffer.from(b);

	if (aBuffer.length !== bBuffer.length) {
		return false;
	}

	return timingSafeEqual(aBuffer, bBuffer);
}

export function createSessionCookie(
	userId: number,
	secret: string,
	secure: boolean
): SessionCookie {
	const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
	const payload = `${userId}.${expiresAt}`;
	const value = `${payload}.${sign(payload, secret)}`;

	return {
		name: SESSION_COOKIE_NAME,
		value,
		options: {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			secure,
			maxAge: MAX_AGE_SECONDS
		}
	};
}

export function readSessionCookie(
	rawValue: string | undefined,
	secret: string
): SessionPayload | null {
	if (!rawValue) {
		return null;
	}

	const parts = rawValue.split('.');
	if (parts.length !== 3) {
		return null;
	}

	const [userIdRaw, expiresAtRaw, signature] = parts;
	if (!userIdRaw || !expiresAtRaw || !signature) {
		return null;
	}

	const userId = Number(userIdRaw);
	const expiresAt = Number(expiresAtRaw);

	if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(expiresAt)) {
		return null;
	}

	if (expiresAt <= Date.now()) {
		return null;
	}

	const expected = sign(`${userId}.${expiresAt}`, secret);
	if (!signaturesMatch(signature, expected)) {
		return null;
	}

	return { userId, expiresAt };
}
