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
	<meta name="description" content="Your practice progress from Toggl Track." />
</svelte:head>

<main class="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
	<header class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<p class="text-xs font-semibold tracking-[0.35em] text-amber-300/60 uppercase">Home Guild</p>
			<h1 class="mt-2 font-display text-3xl text-amber-50 sm:text-4xl">
				Hello, {data.user.display_name}
			</h1>
			<p class="mt-2 max-w-xl text-sm text-stone-400">
				Every minute of practice is 10 XP. Your Toggl Track time becomes skill levels.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<form method="POST" action="?/sync">
				<button class="rpg-button" type="submit" disabled={syncDisabled}>
					{#if !data.togglConfigured}
						Toggl not configured
					{:else if secondsLeft > 0}
						Sync in {formatWait(secondsLeft)}
					{:else}
						Sync now
					{/if}
				</button>
			</form>

			<form method="POST" action="?/logout">
				<button class="rpg-button-ghost" type="submit">Log out</button>
			</form>
		</div>
	</header>

	{#if !data.togglConfigured}
		<div class="mb-6 rounded-xl border border-amber-300/20 bg-amber-950/20 px-5 py-4 text-sm">
			<p class="font-medium text-amber-200">Toggl is not connected yet</p>
			<p class="mt-1 text-amber-100/70">
				Add <code class="rounded bg-black/30 px-1.5 py-0.5">TOGGL_API_TOKEN</code> to your
				<code class="rounded bg-black/30 px-1.5 py-0.5">.env</code> file and restart the server. You can
				find the token in Toggl Track → Profile Settings → API Token.
			</p>
		</div>
	{/if}

	{#if errorMessage}
		<div class="mb-6 rounded-xl border border-red-400/30 bg-red-950/30 px-5 py-4 text-sm">
			<p class="font-medium text-red-200">Sync failed</p>
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
				<p class="text-xs tracking-[0.25em] text-stone-500 uppercase">Hero level</p>
				<p class="mt-1 font-display text-5xl leading-none text-amber-100">
					{data.globalProgress.level}
				</p>
			</div>

			<div class="text-left sm:text-right">
				<p class="text-lg font-semibold text-amber-200">{data.totalXp} XP</p>
				<p class="text-xs text-stone-500">
					{data.skills.length}
					{data.skills.length === 1 ? 'skill' : 'skills'} · {data.totalTimeLabel}
				</p>
			</div>
		</div>

		<div class="mt-5">
			<ProgressBar value={data.globalProgress.progress} label="Hero level progress" size="sm" />
			<div class="mt-2 flex items-baseline justify-between text-xs text-stone-500">
				<span>
					{data.globalProgress.xpIntoLevel} / {data.globalProgress.xpForNextLevel} XP
				</span>
				<span>to level {data.globalProgress.level + 1}</span>
			</div>
		</div>
	</section>

	<section>
		<div class="mb-4 flex items-center justify-between">
			<h2 class="font-display text-2xl text-stone-100">Skills</h2>
			<span class="text-xs text-stone-500">Toggl Track projects</span>
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
				<h3 class="mt-3 font-display text-xl text-stone-200">Empty skill map</h3>
				<p class="mx-auto mt-2 max-w-md text-sm text-stone-400">
					{#if data.togglConfigured}
						No active projects found in Toggl Track. Create a project (e.g. “Piano” and “Drum pad”),
						track some time, then click “Sync now”.
					{:else}
						Once you add a Toggl token and sync, you'll see one progress bar for each project here.
					{/if}
				</p>
			</div>
		{/if}
	</section>

	<footer
		class="mt-10 flex flex-col gap-2 border-t border-white/5 pt-5 text-xs text-stone-600 sm:flex-row sm:items-center sm:justify-between"
	>
		<span>Last sync: {formatDateTime(data.lastSyncedAt)}</span>
		<span>
			Auto-sync every {data.syncIntervalMinutes} min · data from Toggl Track
		</span>
	</footer>
</main>
