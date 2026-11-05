import type { PublicUser } from '#lib/server/db.ts';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// The user read from the session cookie in hooks.server.ts.
		// `null` means the visitor is not logged in.
		interface Locals {
			user: PublicUser | null;
		}

		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
