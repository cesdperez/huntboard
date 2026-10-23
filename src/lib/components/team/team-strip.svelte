<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import type { Snippet } from 'svelte';
	import { flip } from 'svelte/animate';
	import { OfflineNotice } from '#lib/components/connection/index.js';
	import { TeamAvatar } from '#lib/components/images/index.js';
	import { CountingPoints, Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { Standing } from '#lib/domain/scoring.js';
	import { ordinal } from '#lib/ordinal.js';
	import { plural } from '#lib/plural.js';
	import { REORDER_MS, motionMs } from '#lib/score-motion.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		teamName: string;
		members: string;
		standings: Standing[];
		/** Null until the browser clock runs. */
		countdown: string | null;
		onrename: () => void;
		/** Team actions shown beside "Edit team" in the expanded area. */
		children?: Snippet;
	};

	let { teamName, members, standings, countdown, onrename, children }: Props = $props();

	let expanded = $state(false);
	const own = $derived(standings.find((row) => row.own));
	// Initials appear only once some team has a picture, so a game without pictures looks as before.
	const showAvatars = $derived(standings.some((row) => row.avatarKey));
</script>

<header data-sticky-strip class="sticky top-0 z-30 border-b surface-strip shadow-strip">
	<div class="mx-auto max-w-content">
		<button
			type="button"
			class="flex min-h-row w-full items-center gap-3 px-gutter pt-2 text-left"
			aria-expanded={expanded}
			aria-controls="team-standings"
			onclick={() => (expanded = !expanded)}
		>
			{#if own}
				<span class="type-rank">{ordinal(own.rank)}</span>
			{/if}
			{#if showAvatars}
				<TeamAvatar
					name={teamName}
					avatarKey={own?.avatarKey ?? null}
					class="size-10 text-[17px]"
				/>
			{/if}
			<span class="min-w-0 flex-1">
				<span class="block truncate type-heading">{teamName}</span>
				{#if members}<span class="block truncate type-secondary">{members}</span>{/if}
			</span>
			<CountingPoints value={own?.total ?? 0} />
			<ChevronDownIcon
				aria-hidden="true"
				class={cn('size-5 shrink-0 transition-transform duration-150', expanded && 'rotate-180')}
			/>
			<span class="sr-only">{expanded ? 'Hide' : 'Show'} the scoreboard</span>
		</button>
		<p class="px-gutter pb-2 type-secondary tabular-nums">{countdown ?? ' '}</p>
		<OfflineNotice class="px-gutter pb-2" />

		{#if expanded}
			<div id="team-standings" class="flex flex-col gap-3 px-gutter pb-4">
				<ol class="flex max-h-[50dvh] flex-col overflow-y-auto border-t" aria-label="Scoreboard">
					{#each standings as row, index (row.teamId)}
						<!-- Higher ranks paint on top, so a climbing team slides over the rows it passes. -->
						<li
							class={cn(
								'relative flex min-h-touch items-center gap-3 border-b border-l-4 border-l-transparent bg-surface pl-2',
								row.own && 'border-l-own bg-own-row font-semibold'
							)}
							animate:flip={{ duration: motionMs(REORDER_MS) }}
							style:z-index={standings.length - index}
						>
							<span class="w-10 shrink-0 tabular-nums">{ordinal(row.rank)}</span>
							{#if showAvatars}
								<TeamAvatar name={row.name} avatarKey={row.avatarKey} class="size-8 text-[15px]" />
							{/if}
							<span class="min-w-0 flex-1 truncate">
								{row.name}{#if row.own}<span class="sr-only">, your team</span>{/if}
								{#if row.members}<span class="block truncate type-secondary font-normal"
										>{row.members}</span
									>{/if}
							</span>
							<Points value={row.total} />
						</li>
					{/each}
				</ol>
				<div class="flex flex-wrap gap-3">
					<Button class="flex-1" onclick={onrename}>Edit team</Button>
					{@render children?.()}
				</div>
			</div>
		{/if}
	</div>

	<p class="sr-only" aria-live="polite">
		{own ? `${ordinal(own.rank)} place, ${plural(own.total, 'point')}` : ''}
	</p>
</header>
