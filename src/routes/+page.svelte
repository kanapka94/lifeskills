<script lang="ts">
	import type { PageProps } from './$types';
	import SkillCard from '#lib/components/SkillCard.svelte';
	import ProgressBar from '#lib/components/ProgressBar.svelte';
	import { formatDateTime, formatWait } from '#lib/game/format.ts';

	let { data, form }: PageProps = $props();

	// svelte-ignore state_referenced_locally
	let secondsLeft = $state(data.nextSyncInSeconds);

	// The countdown to the next sync runs only in the browser.
	// The server checks the limit again in the `sync` action, so the client
	// can't bypass it by tampering with the counter.
	$effect(() => {
		secondsLeft = data.nextSyncInSeconds;

		const timer = setInterval(() => {
			secondsLeft = Math.max(0, secondsLeft - 1);
		}, 1000);

		return () => clearInterval(timer);
	});

	const syncDisabled = $derived(!data.togglConfigured || secondsLeft > 0);
	const errorMessage = $derived(form?.syncError ?? data.syncError);
	const warningMessage = $derived(form?.syncWarning ?? data.syncWarning);
</script>

<svelte:head>
	<title>Dashboard · LifeExp</title>
	<meta name="description" content="Twój postęp ćwiczeń z Toggl Track." />
</svelte:head>

<main class="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-xs font-semibold tracking-[0.35em] text-amber-300/60 uppercase">
				Gildia Domowa
			</p>
			<h1 class="mt-2 font-display text-3xl text-amber-50 sm:text-4xl">
				Cześć, {data.user.display_name}
			</h1>
			<p class="mt-2 max-w-xl text-sm text-stone-400">
				Każda minuta ćwiczeń to 10 XP. Twój czas z Toggl Track zamieniamy na poziomy umiejętności.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<form method="POST" action="?/sync">
				<button class="rpg-button" type="submit" disabled={syncDisabled}>
					{#if !data.togglConfigured}
						Toggl nieskonfigurowany
					{:else if secondsLeft > 0}
						Sync za {formatWait(secondsLeft)}
					{:else}
						Synchronizuj
					{/if}
				</button>
			</form>

			<form method="POST" action="?/logout">
				<button class="rpg-button-ghost" type="submit">Wyloguj</button>
			</form>
		</div>
	</header>

	{#if !data.togglConfigured}
		<div class="mb-6 rounded-xl border border-amber-300/20 bg-amber-950/20 px-5 py-4 text-sm">
			<p class="font-medium text-amber-200">Toggl nie jest jeszcze podłączony</p>
			<p class="mt-1 text-amber-100/70">
				Dodaj <code class="rounded bg-black/30 px-1.5 py-0.5">TOGGL_API_TOKEN</code> do pliku
				<code class="rounded bg-black/30 px-1.5 py-0.5">.env</code> i zrestartuj serwer. Token znajdziesz
				w Toggl Track → Profile Settings → API Token.
			</p>
		</div>
	{/if}

	{#if errorMessage}
		<div class="mb-6 rounded-xl border border-red-400/30 bg-red-950/30 px-5 py-4 text-sm">
			<p class="font-medium text-red-200">Nie udało się zsynchronizować</p>
			<p class="mt-1 text-red-100/70">{errorMessage}</p>
		</div>
	{/if}

	{#if warningMessage}
		<div
			class="mb-6 rounded-xl border border-sky-400/20 bg-sky-950/30 px-5 py-4 text-sm text-sky-100/80"
		>
			{warningMessage}
		</div>
	{/if}

	<section class="rpg-panel mb-6 p-6 sm:p-7">
		<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<p class="text-xs tracking-[0.25em] text-stone-500 uppercase">Poziom bohatera</p>
				<p class="mt-1 font-display text-5xl leading-none text-amber-100">
					{data.globalProgress.level}
				</p>
			</div>

			<div class="text-left sm:text-right">
				<p class="text-lg font-semibold text-amber-200">{data.totalXp} XP</p>
				<p class="text-xs text-stone-500">
					{data.skills.length}
					{data.skills.length === 1 ? 'umiejętność' : 'umiejętności'} · {data.totalTimeLabel}
				</p>
			</div>
		</div>

		<div class="mt-5">
			<ProgressBar value={data.globalProgress.progress} label="Postęp poziomu bohatera" size="sm" />
			<div class="mt-2 flex items-baseline justify-between text-xs text-stone-500">
				<span>
					{data.globalProgress.xpIntoLevel} / {data.globalProgress.xpForNextLevel} XP
				</span>
				<span>do poziomu {data.globalProgress.level + 1}</span>
			</div>
		</div>
	</section>

	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="font-display text-2xl text-stone-100">Umiejętności</h2>
			<span class="text-xs text-stone-500">Projekty z Toggl Track</span>
		</div>

		{#if data.skills.length > 0}
			<div class="grid gap-5 md:grid-cols-2">
				{#each data.skills as skill (skill.id)}
					<SkillCard {skill} />
				{/each}
			</div>
		{:else}
			<div class="rpg-panel p-8 text-center">
				<p class="text-3xl" aria-hidden="true">🗺️</p>
				<h3 class="mt-3 font-display text-xl text-stone-200">Pusta mapa umiejętności</h3>
				<p class="mx-auto mt-2 max-w-md text-sm text-stone-400">
					{#if data.togglConfigured}
						Nie znaleziono aktywnych projektów w Toggl Track. Utwórz projekt (np. „Pianino” i „Pad
						perkusyjny”), zaloguj czas, a potem kliknij „Synchronizuj”.
					{:else}
						Po dodaniu tokena Toggl i synchronizacji zobaczysz tutaj jeden pasek postępu na każdy
						projekt.
					{/if}
				</p>
			</div>
		{/if}
	</section>

	<footer
		class="mt-10 flex flex-col gap-2 border-t border-white/5 pt-5 text-xs text-stone-600 sm:flex-row sm:items-center sm:justify-between"
	>
		<span>Ostatnia synchronizacja: {formatDateTime(data.lastSyncedAt)}</span>
		<span>
			Automatyczna synchronizacja co {data.syncIntervalMinutes} min · dane z Toggl Track
		</span>
	</footer>
</main>
