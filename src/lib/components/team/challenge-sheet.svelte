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
	import type { ClaimMedia } from '#lib/domain/claim-media.js';
	import { claimEditedLine, claimLine } from '#lib/domain/claim-messages.js';
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
	/** The claim whose edit form is showing, so a new claim on the same challenge starts closed. */
	let editing = $state<number | null>(null);
	let editDrafts = $state<Record<number, string>>({});
	/** Claims whose sent photo or video the team chose to remove when saving the edit. */
	let removedSent = $state<Record<number, boolean>>({});

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

	function startEdit(claimId: number, note: string | null) {
		editing = claimId;
		editDrafts[claimId] = note ?? '';
		removedSent[claimId] = false;
		action.clearError();
		media.clear();
	}

	function stopEdit(claimId: number, challengeId: number) {
		if (editing === claimId) editing = null;
		delete editDrafts[claimId];
		delete removedSent[claimId];
		uploadFor(challengeId).clear();
	}

	function removeSent(claimId: number) {
		removedSent[claimId] = true;
		void focusAfterSwap(() => addButton);
	}

	const mediaChange = (claimId: number) =>
		media.key ? 'replace' : removedSent[claimId] ? 'remove' : 'keep';

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

	const edit: SubmitFunction = (input) => {
		const challengeId = sentChallenge(input.formData);
		const claimId = Number(input.formData.get('claimId'));
		return actionFor(challengeId).submit(
			'Claim updated',
			() => {
				stopEdit(claimId, challengeId);
				closeIfShowing(challengeId);
			},
			() => {
				const before = claimOf(challengeId)?.editedAt;
				return () => {
					const after = claimOf(challengeId);
					return after?.id === claimId && after.editedAt !== before;
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
				{@const edited = claimEditedLine(claim, clock.formatTime)}
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
							<p class="type-secondary break-words">Note: <bdi>{claim.note}</bdi></p>
						{/if}
						{#if line}<p class="type-secondary">{line}</p>{/if}
						{#if edited}<p class="type-secondary">{edited}</p>{/if}
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

			{#snippet mediaField(sent: ClaimMedia | null)}
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
					{#if sent}
						{@const noun = sent.kind === 'video' ? 'video' : 'photo'}
						<div class="flex items-center gap-3">
							<MediaThumb kind={sent.kind} src={sent.src} class="size-10" />
							<span class="min-w-0 flex-1 type-secondary">
								{sent.kind === 'video' ? 'Video sent' : 'Photo sent'}
							</span>
							<Button
								bind:ref={addButton}
								aria-label="Replace {noun}"
								onclick={() => fileInput?.click()}
							>
								Replace
							</Button>
							<Button
								variant="ghost"
								aria-label="Remove {noun}"
								onclick={() => claim && removeSent(claim.id)}
							>
								Remove
							</Button>
						</div>
					{:else}
						<Button bind:ref={addButton} onclick={() => fileInput?.click()}>
							Add photo or video
						</Button>
					{/if}
				{/if}
			{/snippet}

			{#if claim?.status === 'pending' && editing === claim.id}
				<form method="POST" action="?/edit" class="flex flex-col gap-4" use:enhance={edit}>
					<input type="hidden" name="claimId" value={claim.id} />
					<input type="hidden" name="challengeId" value={challenge.id} />
					<input type="hidden" name="nickname" value={nickname.value ?? ''} />
					<input type="hidden" name="media" value={mediaChange(claim.id)} />
					<input type="hidden" name="mediaKey" value={media.key ?? ''} />
					<div class="flex flex-col gap-2">
						<Label for="claim-edit-note">
							Note <span class="font-normal text-muted">(optional)</span>
						</Label>
						<Input
							id="claim-edit-note"
							name="note"
							maxlength={CLAIM_NOTE_MAX_LENGTH}
							autocomplete="off"
							placeholder="Which photo, or what you did"
							disabled={clock.closedMessage !== null}
							bind:value={editDrafts[claim.id]}
						/>
					</div>
					{@render mediaField(removedSent[claim.id] ? null : claim.media)}
					{@render message()}
					<Button
						type="submit"
						variant="primary"
						size="lg"
						disabled={clock.closedMessage !== null}
						busy={action.busy || media.busy}
					>
						{media.busy ? 'Waiting for the upload' : 'Save changes'}
					</Button>
					<Button variant="ghost" onclick={() => stopEdit(claim.id, challenge.id)}>Cancel</Button>
				</form>
			{:else if claim?.status === 'pending'}
				<div class="flex flex-col gap-4">
					{@render message()}
					<Button
						variant="primary"
						size="lg"
						disabled={clock.closedMessage !== null}
						onclick={() => startEdit(claim.id, claim.note)}
					>
						Edit claim
					</Button>
					<form method="POST" action="?/undo" class="flex flex-col gap-2" use:enhance={undo}>
						<input type="hidden" name="claimId" value={claim.id} />
						<input type="hidden" name="challengeId" value={challenge.id} />
						<Button
							type="submit"
							variant="ghost"
							disabled={clock.closedMessage !== null}
							busy={action.busy}
						>
							Undo claim
						</Button>
						<p class="text-center type-secondary">
							Undo takes the claim back. Use it when you marked the wrong challenge.
						</p>
					</form>
				</div>
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
					{@render mediaField(null)}
					{@render message()}
					<Button
						type="submit"
						variant="primary"
						size="lg"
						disabled={clock.closedMessage !== null}
						busy={action.busy || media.busy}
					>
						{media.busy ? 'Waiting for the upload' : 'Mark done'}
					</Button>
				</form>
			{:else if action.error}
				<p class="text-[15px] text-danger" role="alert">{action.error}</p>
			{/if}
		{/if}
	</Sheet.Content>
</Sheet.Root>
