import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing.
 *
 * argon2id is currently the recommended algorithm. The parameters are the
 * defaults for @node-rs/argon2 (m=19456, t=2, p=1), a reasonable trade-off
 * between security and login time.
 */

const ARGON_OPTIONS = {
	memoryCost: 19456,
	timeCost: 2,
	parallelism: 1
};

/**
 * A valid "dummy" hash used when the login doesn't exist. This makes
 * verification take a similar amount of time and doesn't reveal whether
 * a given user exists.
 */
const DUMMY_PASSWORD_HASH =
	'$argon2id$v=19$m=19456,t=2,p=1$BV+myFobC96eDuRj1Dm11w$h16u0W5pDuFhW9scB9SJ28d1AkCJAhd/hjDuk+0Y/QQ';

export function hashPassword(password: string): Promise<string> {
	return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password);
	} catch {
		return false;
	}
}

export function verifyDummyPassword(password: string): Promise<boolean> {
	return verifyPassword(DUMMY_PASSWORD_HASH, password);
}
