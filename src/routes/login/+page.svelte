<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Logowanie · LifeExp</title>
	<meta name="description" content="Zaloguj się do swojego dziennika ćwiczeń." />
</svelte:head>

<main class="flex min-h-screen items-center justify-center px-4 py-12">
	<section class="rpg-panel w-full max-w-md p-8 sm:p-10">
		<header class="mb-8 text-center">
			<p class="mb-2 text-xs font-semibold tracking-[0.35em] text-amber-300/60 uppercase">
				Gildia Domowa
			</p>
			<h1 class="font-display text-4xl text-amber-100">LifeExp</h1>
			<p class="mt-3 text-sm text-stone-400">
				Zaloguj się, aby zobaczyć postęp swoich umiejętności.
			</p>
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
				<span class="mb-2 block text-sm font-medium text-stone-300">Login</span>
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
				<span class="mb-2 block text-sm font-medium text-stone-300">Hasło</span>
				<input
					class="rpg-input"
					type="password"
					name="password"
					autocomplete="current-password"
					required
				/>
			</label>

			<button class="rpg-button w-full" type="submit">Wejdź do gildii</button>
		</form>

		<p class="mt-8 text-center text-xs text-stone-500">
			Po trzech nieudanych próbach logowanie z Twojego adresu IP zostanie zablokowane na 15 minut.
		</p>
	</section>
</main>
