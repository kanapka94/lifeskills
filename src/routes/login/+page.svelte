<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Log in · LifeExp</title>
	<meta name="description" content="Log in to your practice journal." />
</svelte:head>

<main class="flex min-h-screen items-center justify-center px-4 py-12">
	<section class="rpg-panel w-full max-w-md p-8 sm:p-10">
		<header class="mb-8 text-center">
			<p class="mb-2 text-xs font-semibold tracking-[0.35em] text-amber-300/60 uppercase">
				Home Guild
			</p>
			<h1 class="font-display text-4xl text-amber-100">LifeExp</h1>
			<p class="mt-3 text-sm text-stone-400">Log in to see your skill progress.</p>
		</header>

		{#if form?.error}
			<div
				class="mb-6 rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200"
			>
				{form.error}
			</div>
		{/if}

		<form method="POST" class="space-y-5">
			<input type="hidden" name="redirectTo" value={form?.redirectTo ?? data.redirectTo} />

			<label class="block">
				<span class="mb-2 block text-sm font-medium text-stone-300">Username</span>
				<input
					class="rpg-input"
					type="text"
					name="username"
					value={form?.username ?? ''}
					autocomplete="username"
					autocapitalize="none"
					spellcheck="false"
					required
				/>
			</label>

			<label class="block">
				<span class="mb-2 block text-sm font-medium text-stone-300">Password</span>
				<input
					class="rpg-input"
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
			</label>

			<button class="rpg-button w-full" type="submit">Enter the guild</button>
		</form>

		<p class="mt-8 text-center text-xs text-stone-500">
			After three failed attempts, logging in from your IP address will be blocked for 15 minutes.
		</p>
	</section>
</main>
