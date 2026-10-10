<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Standing } from '#lib/domain/scoring.js';
	import { ordinal } from '#lib/ordinal.js';
	import { plural } from '#lib/plural.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		teamName: string;
		standings: Standing[];
		/** Null until the browser clock runs. */
		countdown: string | null;
		onrename: () => void;
	};

	let { teamName, standings, countdown, onrename }: Props = $props();

	let expanded = $state(false);
	const own = $derived(standings.find((row) => row.own));
</script>

<header class="sticky top-0 z-30 border-b bg-surface shadow-strip">
	<div class="mx-auto max-w-content">
		<button
			type="button"
			class="flex min-h-row w-full items-center gap-3 px-gutter pt-2 text-left"
			aria-expanded={expanded}
			aria-controls="team-standings"
			onclick={() => (expanded = !expanded)}
		>
			{#if own}
				<span class="type-score text-[28px]">{ordinal(own.rank)}</span>
			{/if}
			<span class="min-w-0 flex-1 truncate type-heading">{teamName}</span>
			<Points value={own?.total ?? 0} variant="total" />
			<ChevronDownIcon
				aria-hidden="true"
				class={cn('size-5 shrink-0 transition-transform duration-150', expanded && 'rotate-180')}
			/>
			<span class="sr-only">{expanded ? 'Hide' : 'Show'} the scoreboard</span>
		</button>
		<p class="px-gutter pb-2 type-secondary tabular-nums">{countdown ?? ' '}</p>

		{#if expanded}
			<div id="team-standings" class="flex flex-col gap-3 px-gutter pb-4">
				<ol class="flex max-h-[50dvh] flex-col overflow-y-auto border-t" aria-label="Scoreboard">
					{#each standings as row, index (index)}
						<li
							class={cn(
								'flex min-h-touch items-center gap-3 border-b border-l-4 border-l-transparent pl-2',
								row.own && 'border-l-flag font-semibold'
							)}
						>
							<span class="w-10 shrink-0 tabular-nums">{ordinal(row.rank)}</span>
							<span class="min-w-0 flex-1 truncate">
								{row.name}{#if row.own}<span class="sr-only">, your team</span>{/if}
							</span>
							<Points value={row.total} />
						</li>
					{/each}
				</ol>
				<Button onclick={onrename}>Rename team</Button>
			</div>
		{/if}
	</div>

	<p class="sr-only" aria-live="polite">
		{own ? `${ordinal(own.rank)} place, ${plural(own.total, 'point')}` : ''}
	</p>
</header>
