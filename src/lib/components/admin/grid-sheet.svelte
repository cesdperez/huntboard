<script lang="ts">
	import { Marker, markerLabel } from '#lib/components/marker/index.js';
	import { ClaimMediaView } from '#lib/components/media/index.js';
	import { Points } from '#lib/components/points/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { formatClockTime } from '#lib/format/clock-time.js';
	import { earlierRejectionsText } from '#lib/format/earlier-rejections.js';
	import type { GridRow, GridTeam } from '#lib/domain/judging-grid.js';
	import JudgePanel, { type JudgeTarget } from './judge-panel.svelte';

	type Props = {
		row: GridRow | null;
		team: GridTeam | null;
		open: boolean;
		/** The cell that opened the sheet, which takes focus back when it closes. */
		opener: HTMLElement | null;
		onclose: () => void;
	};

	let { row, team, open, opener, onclose }: Props = $props();

	let content = $state<HTMLElement | null>(null);

	const cell = $derived(row?.cells.find((each) => each.teamId === team?.id) ?? null);
	const claim = $derived(cell?.claim ?? null);
	// One target for every state, so the panel and its error survive a claim changing under it.
	const target = $derived<JudgeTarget | null>(
		row && team
			? claim && claim.status !== 'rejected'
				? { claimId: claim.id, from: claim.status, teamId: team.id, challengeId: row.id }
				: { teamId: team.id, challengeId: row.id }
			: null
	);
	const hint = $derived.by(() => {
		switch (claim?.status) {
			case undefined:
				return 'No claim yet. Score it here for proof that came in person.';
			case 'pending':
				return null;
			case 'scored':
				return 'Fix the score or reject it.';
			case 'rejected':
				return 'Score it anyway if the proof turned up.';
		}
	});

	const formatTime = (iso: string) => formatClockTime(iso, new Date());
</script>

<Sheet.Root open={open && target !== null} onOpenChange={(isOpen) => !isOpen && onclose()}>
	<Sheet.Content
		bind:ref={content}
		onOpenAutoFocus={(event) => {
			// The default focuses the first field, which opens the phone keyboard over the sheet.
			event.preventDefault();
			content?.focus();
		}}
		onCloseAutoFocus={(event) => {
			// Safari never focuses a tapped button, so the default would leave focus on the page body.
			if (!opener) return;
			event.preventDefault();
			opener.focus();
		}}
	>
		{#if row && team && target}
			<Sheet.Header>
				<Sheet.Title>{row.title}</Sheet.Title>
				<p class="flex flex-wrap items-baseline gap-x-3 type-secondary">
					<span class="font-semibold text-ink">{team.name}</span>
					<Points class="text-ink" min={row.minPoints} max={row.maxPoints} />
					{#if row.section}<span>{row.section}</span>{/if}
				</p>
			</Sheet.Header>

			{#if row.description}
				<Sheet.Description class="line-clamp-4 type-secondary break-words whitespace-pre-line">
					{row.description}
				</Sheet.Description>
			{/if}

			{#if claim}
				<div class="flex items-start gap-3 border-y py-3">
					<Marker state={claim.status} points={claim.points ?? undefined} />
					<div class="flex min-w-0 flex-col gap-1">
						<p class="font-semibold">{markerLabel(claim.status, claim.points ?? undefined)}</p>
						{#if claim.status === 'rejected' && claim.judgeNote}
							<p class="text-danger">{claim.judgeNote}</p>
						{/if}
						{#if claim.note}
							<p class="type-secondary break-words">Note: <bdi>{claim.note}</bdi></p>
						{/if}
						{#if cell?.earlierRejections}
							<p class="type-secondary break-words text-danger!">
								{earlierRejectionsText(cell.earlierRejections)}
							</p>
						{/if}
						<p class="type-secondary">
							Marked done by <bdi>{claim.markedBy}</bdi> at {formatTime(claim.markedAt)}.
						</p>
						{#if claim.judgedBy && claim.status !== 'pending'}
							<p class="type-secondary">Judged by <bdi>{claim.judgedBy}</bdi>.</p>
						{/if}
					</div>
				</div>
				{#if claim.media}
					<ClaimMediaView media={claim.media} label="{team.name}, {row.title}" preload="metadata" />
				{/if}
			{/if}

			{#if hint}<p class="type-secondary">{hint}</p>{/if}

			{#key `${team.id}:${row.id}`}
				<JudgePanel
					{target}
					min={row.minPoints}
					max={row.maxPoints}
					label="{team.name}, {row.title}"
					primary
					ondone={onclose}
				/>
			{/key}
		{/if}
	</Sheet.Content>
</Sheet.Root>
