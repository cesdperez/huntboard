<script lang="ts">
	import { enhance } from '$app/forms';
	import { CLAIM_NOTE_MAX_LENGTH } from '#lib/claim-note.js';
	import { Marker, markerLabel } from '#lib/components/marker/index.js';
	import { nickname } from '#lib/components/nickname/index.js';
	import { Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { claimLine } from '#lib/domain/claim-messages.js';
	import type { TeamChallenge } from '#lib/domain/team-board.js';
	import type { GameClock } from './game-clock.svelte.js';
	import { TeamAction } from './team-action.svelte.js';

	type Props = {
		challenge: TeamChallenge | null;
		open: boolean;
		clock: GameClock;
		onclose: () => void;
	};

	let { challenge, open, clock, onclose }: Props = $props();

	let content = $state<HTMLElement | null>(null);
	let drafts = $state<Record<number, string>>({});
	const action = new TeamAction(
		() => clock,
		() => `${challenge?.id}:${challenge?.claim?.id}:${challenge?.claim?.status}`
	);

	const claim = $derived(challenge?.claim ?? null);
	const canMark = $derived(!claim || claim.status === 'rejected');

	function close() {
		action.clearError();
		onclose();
	}

	function marked(formData: FormData) {
		delete drafts[Number(formData.get('challengeId'))];
		close();
	}
</script>

<Sheet.Root open={open && challenge !== null} onOpenChange={(isOpen) => !isOpen && close()}>
	<Sheet.Content
		bind:ref={content}
		onOpenAutoFocus={(event) => {
			// The default focuses the note field, which opens the phone keyboard over the sheet.
			event.preventDefault();
			content?.focus();
		}}
	>
		{#if challenge}
			<Sheet.Header>
				<Sheet.Title>{challenge.title}</Sheet.Title>
				<p class="flex flex-wrap items-baseline gap-x-3 type-secondary">
					<Points class="text-ink" min={challenge.minPoints} max={challenge.maxPoints} />
					{#if challenge.section}<span>{challenge.section}</span>{/if}
				</p>
			</Sheet.Header>

			{#if challenge.description}
				<Sheet.Description class="type-body whitespace-pre-line text-ink">
					{challenge.description}
				</Sheet.Description>
			{/if}

			{#if claim}
				{@const line = claimLine(claim, clock.formatTime)}
				<div class="flex items-start gap-3 border-y py-3">
					<Marker state={claim.status} points={claim.points ?? undefined} />
					<div class="flex min-w-0 flex-col gap-1">
						<p class="font-semibold">
							{claim.status === 'pending'
								? 'Waiting for a judge'
								: markerLabel(claim.status, claim.points ?? undefined)}
						</p>
						{#if claim.status === 'rejected' && claim.judgeNote}
							<p class="text-danger">{claim.judgeNote}</p>
						{/if}
						{#if line}<p class="type-secondary">{line}</p>{/if}
						{#if claim.note}
							<p class="type-secondary break-words">Note: {claim.note}</p>
						{/if}
					</div>
				</div>
			{/if}

			{#snippet message()}
				{#if action.error}
					<p class="text-[15px] text-danger" role="alert">{action.error}</p>
				{:else if clock.closedMessage}
					<p class="type-secondary">{clock.closedMessage}</p>
				{/if}
			{/snippet}

			{#if claim?.status === 'pending'}
				<form
					method="POST"
					action="?/undo"
					class="flex flex-col gap-4"
					use:enhance={action.submit('Claim undone', close)}
				>
					<input type="hidden" name="claimId" value={claim.id} />
					{@render message()}
					<Button type="submit" size="lg" disabled={action.busy || clock.closedMessage !== null}>
						Undo claim
					</Button>
				</form>
			{:else if canMark}
				<form
					method="POST"
					action="?/mark"
					class="flex flex-col gap-4"
					use:enhance={action.submit('Marked done', marked)}
				>
					<input type="hidden" name="challengeId" value={challenge.id} />
					<input type="hidden" name="nickname" value={nickname.value ?? ''} />
					<div class="flex flex-col gap-2">
						<Label for="claim-note">
							Note <span class="font-normal text-muted">(optional)</span>
						</Label>
						<Input
							id="claim-note"
							name="note"
							maxlength={CLAIM_NOTE_MAX_LENGTH}
							autocomplete="off"
							placeholder="Which photo, or what you did"
							bind:value={drafts[challenge.id]}
						/>
					</div>
					{@render message()}
					<Button
						type="submit"
						variant="primary"
						size="lg"
						disabled={action.busy || clock.closedMessage !== null}
					>
						Mark done
					</Button>
				</form>
			{/if}
		{/if}
	</Sheet.Content>
</Sheet.Root>
