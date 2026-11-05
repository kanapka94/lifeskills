import tailwindcss from '@tailwindcss/vite';
import { defineConfig, loadEnv } from 'vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
	// We also load .env into the build process. This way `ORIGIN` ends up in
	// the SvelteKit config and adapter-node knows which address is the app's
	// own (important for CSRF protection in production).
	const env = loadEnv(mode, process.cwd(), '');

	return {
		plugins: [
			tailwindcss(),
			sveltekit({
				paths: {
					// adapter-node uses this as the base request URL. Without it,
					// it assumes `https`, which blocks forms on local HTTP.
					origin: mode === 'production' ? env.ORIGIN || undefined : undefined
				},
				compilerOptions: {
					// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
					runes: ({ filename }) =>
						filename.split(/[/\\]/).includes('node_modules') ? undefined : true
				},
				adapter: adapter()
			})
		],
		test: {
			expect: { requireAssertions: true },
			projects: [
				{
					extends: './vite.config.ts',
					test: {
						name: 'server',
						environment: 'node',
						include: ['src/**/*.{test,spec}.{js,ts}'],
						exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
					}
				}
			]
		}
	};
});
