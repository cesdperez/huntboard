<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import GridSheet from '#lib/components/admin/grid-sheet.svelte';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { Marker, markerLabel } from '#lib/components/marker/index.js';
	import { Points } from '#lib/components/points/index.js';
	import { groupBySection } from '#lib/format/group-by-section.js';
	import { startPolling } from '#lib/client/live-updates.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The ids outlive the open flag, so the sheet keeps its content while it slides away.
	let selected = $state<{ teamId: number; challengeId: number } | null>(null);
	let sheetOpen = $state(false);
	let opener = $state<HTMLElement | null>(null);
	const selectedRow = $derived(data.rows.find((row) => row.id === selected?.challengeId) ?? null);
	const selectedTeam = $derived(data.teams.find((team) => team.id === selected?.teamId) ?? null);

	let box = $state<HTMLElement | null>(null);
	let boxTop = $state(0);

	function measureBox() {
		if (box) boxTop = box.getBoundingClientRect().top + window.scrollY;
	}

	onMount(() => {
		// The header above settles after fonts and the nickname load, and the page is min-h-dvh,
		// so the body resizes whenever the box's top or the viewport changes.
		const observer = new ResizeObserver(measureBox);
		observer.observe(document.body);
		const stopPolling = startPolling(refreshGameData);
		return () => {
			observer.disconnect();
			stopPolling();
		};
	});

	// Browsers skip the focus scroll while a sliver of the cell shows, which leaves it under the edge.
	function revealFocused(event: FocusEvent) {
		if (event.target instanceof HTMLElement) {
			event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
		}
	}

	function select(teamId: number, challengeId: number, cell: HTMLElement) {
		selected = { teamId, challengeId };
		opener = cell;
		sheetOpen = true;
	}
</script>

<!-- The column is the content width minus the gutters, so the title lines up with the header. -->
<h1 class="mx-auto max-w-[calc(var(--container-content)-2*var(--spacing-gutter))] type-title">
	Grid
</h1>

{#if data.teams.length === 0 || data.rows.length === 0}
	<p
		class="mx-auto mt-6 max-w-[calc(var(--container-content)-2*var(--spacing-gutter))] type-secondary"
	>
		The grid fills once the game has teams and challenges. Add them in
		<a
			class="font-semibold text-ink underline"
			href={resolve('/a/[token]/setup', { token: data.game.admin_token })}>Setup</a
		>.
	</p>
{:else}
	<div
		bind:this={box}
		onfocusin={revealFocused}
		style:--grid-top="{boxTop}px"
		class="grid-box -mx-gutter mt-4 scroll-pt-16 scroll-pl-40 overflow-auto overscroll-x-contain border-y pr-[env(safe-area-inset-right)] sm:scroll-pl-64 lg:mx-auto lg:w-fit lg:max-w-full lg:border-x"
	>
		<table class="border-separate border-spacing-0">
			<thead>
				<tr>
					<th
						scope="col"
						class="sticky top-0 left-0 z-20 border-b bg-paper py-2 pr-gutter pl-[max(var(--spacing-gutter),env(safe-area-inset-left))] text-left type-secondary font-semibold"
					>
						Challenge
					</th>
					{#each data.teams as team (team.id)}
						<th
							scope="col"
							class="sticky top-0 z-10 w-18 max-w-18 min-w-18 border-b bg-paper px-1 py-2 align-bottom text-[15px] leading-tight font-semibold break-words lg:w-auto lg:max-w-none"
						>
							<span class="line-clamp-2 lg:max-w-32" title={team.name}>{team.name}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each groupBySection(data.rows) as group, groupIndex (groupIndex)}
					{#if group.section}
						<tr>
							<th colspan={data.teams.length + 1} class="border-b px-0 pt-4 pb-1 text-left">
								<span
									class="sticky left-0 pr-gutter pl-[max(var(--spacing-gutter),env(safe-area-inset-left))] font-display type-heading"
									>{group.section}</span
								>
							</th>
						</tr>
					{/if}
					{#each group.items as row (row.id)}
						<tr>
							<th
								scope="row"
								class="sticky left-0 z-10 w-40 max-w-40 min-w-40 border-b bg-paper py-1 pr-2 pl-[max(var(--spacing-gutter),env(safe-area-inset-left))] text-left font-normal sm:w-64 sm:max-w-64 sm:min-w-64"
							>
								<span class="line-clamp-2 text-[15px] leading-snug break-words">{row.title}</span>
								<Points class="text-muted" min={row.minPoints} max={row.maxPoints} />
							</th>
							{#each row.cells as cell, column (cell.teamId)}
								{@const team = data.teams[column]}
								{@const state = cell.claim?.status ?? 'open'}
								{@const points = cell.claim?.points ?? undefined}
								<td class="border-b p-0 text-center">
									<button
										type="button"
										class="inline-flex size-14 items-center justify-center"
										aria-label="{team.name}, {row.title}: {markerLabel(state, points)}"
										onclick={(event) => select(cell.teamId, row.id, event.currentTarget)}
									>
										<Marker {state} {points} size="grid" aria-hidden="true" />
									</button>
								</td>
							{/each}
						</tr>
					{/each}
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<GridSheet
	row={selectedRow}
	team={selectedTeam}
	open={sheetOpen}
	{opener}
	onclose={() => (sheetOpen = false)}
/>

<style>
	/* Fits between its own top and the tab bar. A short landscape screen keeps most of its height
	   for the grid instead, and the page scrolls the header away. */
	.grid-box {
		--below: calc(var(--spacing-row) + env(safe-area-inset-bottom) + 1rem);
		max-height: max(
			calc(100dvh - var(--grid-top) - var(--below)),
			min(20rem, calc(100dvh - var(--below)))
		);
	}
</style>
