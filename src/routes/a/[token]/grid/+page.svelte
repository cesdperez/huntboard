<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import GridSheet from '#lib/components/admin/grid-sheet.svelte';
	import { refreshGameData } from '#lib/components/connection/index.js';
	import { Marker, markerLabel } from '#lib/components/marker/index.js';
	import { Points } from '#lib/components/points/index.js';
	import { groupBySection } from '#lib/group-by-section.js';
	import { startPolling } from '#lib/live-updates.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The ids outlive the open flag, so the sheet keeps its content while it slides away.
	let selected = $state<{ teamId: number; challengeId: number } | null>(null);
	let sheetOpen = $state(false);
	const selectedRow = $derived(data.rows.find((row) => row.id === selected?.challengeId) ?? null);
	const selectedTeam = $derived(data.teams.find((team) => team.id === selected?.teamId) ?? null);

	onMount(() => startPolling(refreshGameData));

	function select(teamId: number, challengeId: number) {
		selected = { teamId, challengeId };
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
		class="-mx-gutter mt-4 max-h-[calc(100dvh-13rem)] scroll-pt-16 scroll-pl-40 overflow-auto overscroll-x-contain border-y sm:scroll-pl-64 lg:mx-auto lg:w-fit lg:max-w-full lg:border-x"
	>
		<table class="border-separate border-spacing-0">
			<thead>
				<tr>
					<th
						scope="col"
						class="sticky top-0 left-0 z-20 border-b bg-paper px-gutter py-2 text-left type-secondary font-semibold"
					>
						Challenge
					</th>
					{#each data.teams as team (team.id)}
						<th
							scope="col"
							class="sticky top-0 z-10 w-18 max-w-18 min-w-18 border-b bg-paper px-1 py-2 align-bottom text-[15px] leading-tight font-semibold break-words"
						>
							<span class="line-clamp-2" title={team.name}>{team.name}</span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each groupBySection(data.rows) as group, groupIndex (groupIndex)}
					{#if group.section}
						<tr>
							<th colspan={data.teams.length + 1} class="border-b px-0 pt-4 pb-1 text-left">
								<span class="sticky left-0 px-gutter type-heading">{group.section}</span>
							</th>
						</tr>
					{/if}
					{#each group.items as row (row.id)}
						<tr>
							<th
								scope="row"
								class="sticky left-0 z-10 w-40 max-w-40 min-w-40 border-b bg-paper py-1 pr-2 pl-gutter text-left font-normal sm:w-64 sm:max-w-64 sm:min-w-64"
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
										onclick={() => select(cell.teamId, row.id)}
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
	onclose={() => (sheetOpen = false)}
/>
