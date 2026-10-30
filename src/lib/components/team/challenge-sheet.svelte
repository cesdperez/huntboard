<script lang="ts">
	import { tick } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { CLAIM_NOTE_MAX_LENGTH } from '#lib/domain/claim-note.js';
	import { Marker, markerLabel } from '#lib/components/marker/index.js';
	import { nickname } from '#lib/components/nickname/index.js';
	import { Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { claimLine } from '#lib/domain/claim-messages.js';
	import type { TeamChallenge } from '#lib/domain/team-board.js';
	import type { GameClock } from '#lib/client/game-clock.svelte.js';
	import { MediaThumb, UploadStatus } from '#lib/components/media/index.js';
	import { ClaimMediaUpload } from './claim-media-upload.svelte.js';
	import { TeamAction } from './team-action.svelte.js';

	type Props = {
		challenge: TeamChallenge | null;
		/** Every challenge, so an answer applies to the one it was sent for, open or not. */
		challenges: TeamChallenge[];
		open: boolean;
		clock: GameClock;
		onclose: () => void;
	};

	let { challenge, challenges, open, clock, onclose }: Props = $props();

	let content = $state<HTMLElement | null>(null);
	let drafts = $state<Record<number, string>>({});

	const claimOf = (challengeId: number) =>
		challenges.find((each) => each.id === challengeId)?.claim ?? null;

	// One per challenge, so a slow answer stays with its challenge and others can be marked meanwhile.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- filled inside $derived, where state must not change; each action holds its own state
	const actions = new Map<number, TeamAction>();
	function actionFor(challengeId: number): TeamAction {
		let found = actions.get(challengeId);
		if (!found) {
			found = new TeamAction(
				() => clock,
				() => {
					const claim = claimOf(challengeId);
					return `${claim?.id}:${claim?.status}`;
				}
			);
			actions.set(challengeId, found);
		}
		return found;
	}
	const action = $derived(actionFor(challenge?.id ?? 0));

	// One per challenge, so a finished upload stays with that challenge's draft note.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- filled inside $derived, where state must not change; each upload holds its own state
	const uploads = new Map<number, ClaimMediaUpload>();
	function uploadFor(challengeId: number): ClaimMediaUpload {
		let upload = uploads.get(challengeId);
		if (!upload) {
			upload = new ClaimMediaUpload((phase) => clock.closedMessageFor(phase));
			uploads.set(challengeId, upload);
		}
		return upload;
	}
	const media = $derived(uploadFor(challenge?.id ?? 0));
	// Leaving the team page must stop the uploads and free the photo previews.
	$effect(() => () => uploads.forEach((upload) => upload.clear()));
	let fileInput = $state<HTMLInputElement | null>(null);
	let addButton = $state<HTMLElement | null>(null);
	let removeButton = $state<HTMLElement | null>(null);

	const claim = $derived(challenge?.claim ?? null);
	const canMark = $derived(!claim || claim.status === 'rejected');

	function close() {
		action.clearError();
		media.stopUnfinished();
		onclose();
	}

	function closeIfShowing(challengeId: number) {
		if (open && challenge?.id === challengeId) close();
	}

	// The button that had focus leaves the page. Left alone, the sheet's focus trap moves focus to
	// the note field, which opens the phone keyboard.
	async function focusAfterSwap(target: () => HTMLElement | null) {
		await tick();
		(target() ?? content)?.focus();
	}

	function picked() {
		const file = fileInput?.files?.[0];
		if (file) {
			void media.start(file);
			void focusAfterSwap(() => removeButton);
		}
		// An empty input lets the same file be picked again after Remove.
		if (fileInput) fileInput.value = '';
	}

	function removeMedia() {
		media.clear();
		void focusAfterSwap(() => addButton);
	}

	const sentChallenge = (formData: FormData) => Number(formData.get('challengeId'));

	const mark: SubmitFunction = (input) => {
		const challengeId = sentChallenge(input.formData);
		return actionFor(challengeId).submit(
			'Marked done',
			() => {
				delete drafts[challengeId];
				uploadFor(challengeId).clear();
				closeIfShowing(challengeId);
			},
			() => {
				const before = claimOf(challengeId)?.id;
				return () => {
					const after = claimOf(challengeId);
					return after !== null && after.id !== before && after.status !== 'rejected';
				};
			}
		)(input);
	};

	const undo: SubmitFunction = (input) => {
		const challengeId = sentChallenge(input.formData);
		const claimId = Number(input.formData.get('claimId'));
		return actionFor(challengeId).submit(
			'Claim undone',
			() => closeIfShowing(challengeId),
			() => () => claimOf(challengeId)?.id !== claimId
		)(input);
	};
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
				<Sheet.Description class="type-body break-words whitespace-pre-line text-ink">
					{challenge.description}
				</Sheet.Description>
			{/if}

			{#if claim}
				{@const line = claimLine(claim, clock.formatTime, clock.closedMessage === null)}
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
						{#if claim.note}
							<p class="type-secondary break-words">Note: {claim.note}</p>
						{/if}
						{#if line}<p class="type-secondary">{line}</p>{/if}
						{#if claim.media}
							<p class="flex items-center gap-2 type-secondary">
								<MediaThumb kind={claim.media.kind} src={claim.media.src} class="size-10" />
								{claim.media.kind === 'video' ? 'Video sent' : 'Photo sent'}
							</p>
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
				<form method="POST" action="?/undo" class="flex flex-col gap-4" use:enhance={undo}>
					<input type="hidden" name="claimId" value={claim.id} />
					<input type="hidden" name="challengeId" value={challenge.id} />
					{@render message()}
					<Button type="submit" size="lg" disabled={action.busy || clock.closedMessage !== null}>
						Undo claim
					</Button>
				</form>
			{:else if canMark}
				<form method="POST" action="?/mark" class="flex flex-col gap-4" use:enhance={mark}>
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
							disabled={clock.closedMessage !== null}
							bind:value={drafts[challenge.id]}
						/>
					</div>
					<input type="hidden" name="mediaKey" value={media.key ?? ''} />
					{#if media.phase !== 'idle' && media.kind}
						<UploadStatus
							phase={media.phase}
							kind={media.kind}
							progress={media.progress}
							preview={media.preview}
							error={media.error}
							onremove={removeMedia}
							bind:removeButton
						/>
					{:else if clock.closedMessage === null}
						<input
							bind:this={fileInput}
							type="file"
							accept="image/*,video/*"
							class="hidden"
							aria-hidden="true"
							tabindex="-1"
							onchange={picked}
						/>
						<Button bind:ref={addButton} onclick={() => fileInput?.click()}>
							Add photo or video
						</Button>
					{/if}
					{@render message()}
					<Button
						type="submit"
						variant="primary"
						size="lg"
						disabled={action.busy || media.busy || clock.closedMessage !== null}
					>
						{media.busy ? 'Waiting for the upload' : 'Mark done'}
					</Button>
				</form>
			{/if}
		{/if}
	</Sheet.Content>
</Sheet.Root>
