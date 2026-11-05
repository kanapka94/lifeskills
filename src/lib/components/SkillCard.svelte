<script lang="ts">
	import type { SkillView } from '#lib/types.ts';
	import ProgressBar from './ProgressBar.svelte';

	type Props = {
		skill: SkillView;
	};

	let { skill }: Props = $props();

	const icon = $derived(pickIcon(skill.name));
	const accent = $derived(skill.color ?? '#e8c27a');
	const percent = $derived(Math.round(skill.progress.progress * 100));

	function pickIcon(name: string): string {
		const lower = name.toLocaleLowerCase('pl-PL');

		if (/pian|piano|keyboard|klawisz/.test(lower)) return '🎹';
		if (/pad|perk|drum|bęben|beben/.test(lower)) return '🥁';
		if (/git|guitar/.test(lower)) return '🎸';
		if (/śpiew|spiew|wokal|vocal|sing/.test(lower)) return '🎤';

		return '⚔️';
	}
</script>

<article class="rpg-panel relative overflow-hidden p-6">
	<div
		class="pointer-events-none absolute inset-x-0 top-0 h-px"
		style={`background: linear-gradient(90deg, transparent, ${accent}, transparent);`}
	></div>

	<header class="flex items-start justify-between gap-4">
		<div class="flex min-w-0 items-center gap-3">
			<span
				class="grid size-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-2xl"
				aria-hidden="true"
			>
				{icon}
			</span>
			<div class="min-w-0">
				<h2 class="truncate font-display text-xl text-stone-100">{skill.name}</h2>
				<p class="mt-0.5 text-xs tracking-[0.2em] text-stone-500 uppercase">
					Poziom {skill.progress.level}
				</p>
			</div>
		</div>

		<div class="shrink-0 text-right">
			<p class="text-3xl leading-none font-semibold text-amber-200">{skill.progress.level}</p>
			<p class="mt-1 text-[10px] tracking-[0.2em] text-stone-500 uppercase">lvl</p>
		</div>
	</header>

	<div class="mt-6">
		<div class="mb-2 flex items-baseline justify-between text-xs text-stone-400">
			<span>{skill.progress.xpIntoLevel} / {skill.progress.xpForNextLevel} XP</span>
			<span>{percent}%</span>
		</div>

		<ProgressBar
			value={skill.progress.progress}
			color={skill.color}
			label={`Postęp: ${skill.name}`}
		/>

		<div class="mt-2 flex items-baseline justify-between gap-3 text-xs text-stone-500">
			<span>{skill.xp} XP łącznie</span>
			<span class="text-right">do awansu brakuje {skill.progress.xpToNextLevel} XP</span>
		</div>
	</div>

	<footer class="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs">
		<span class="inline-flex items-center gap-1.5 text-stone-400">
			<span aria-hidden="true">⏱</span>
			{skill.totalTimeLabel}
		</span>
		<span class="text-stone-600">10 XP = 1 minuta</span>
	</footer>
</article>
