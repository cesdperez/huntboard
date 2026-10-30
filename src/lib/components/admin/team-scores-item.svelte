<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { tick, untrack } from 'svelte';
	import { browser } from '$app/env';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { focusIfLost } from '#lib/client/focus.js';
	import { InPlaceForm } from '#lib/components/in-place-form.svelte.js';
	import { Points } from '#lib/components/points/index.js';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { formatClockTime } from '#lib/format/clock-time.js';
	import { localInputToUtc, utcToLocalInput } from '#lib/format/local-time.js';
	import { ordinal } from '#lib/format/ordinal.js';
	import { isolate } from '#lib/format/text.js';
	import { REASON_MAX_LENGTH } from '#lib/domain/reason.js';
	import type { TeamScoresRow } from '#lib/server/pages/judging-pages.js';
	import { generateToken } from '#lib/domain/token.js';
	import type { Recheck } from '#lib/components/form-action.svelte.js';
	import { AdminAction, type LostAnswer } from './admin-action.svelte.js';
	import { adjustmentAdded } from './adjustment-added.js';

	type Props = {
		team: TeamScoresRow;
		endsAt: string | null;
		latePenaltyPerMinute: number;
	};

	let { team, endsAt, latePenaltyPerMinute }: Props = $props();

	const id = $props.id();
	const arrival = new AdminAction('teamScores', () => team.arrivedAt);
	const adjusting = new AdminAction('teamScores', () => adjustmentIds().join());
	const adjustmentIds = () => team.adjustments.map((adjustment) => adjustment.id);

	const arrivedWhen =
		(arrived: (formData: FormData) => boolean): Recheck<LostAnswer> =>
		(formData) =>
		() =>
			arrived(formData);
	const recorded = arrivedWhen(() => team.arrivedAt !== null);
	const cleared = arrivedWhen(() => team.arrivedAt === null);
	const corrected = arrivedWhen((formData) => team.arrivedAt === formData.get('arrivedAt'));

	const added: Recheck<LostAnswer> = (formData) => {
		const before = adjustmentIds();
		return () => adjustmentAdded(before, team.adjustments, formData);
	};
	const removed: Recheck<LostAnswer> = (formData) => () =>
		!adjustmentIds().includes(Number(formData.get('adjustmentId')));

	// Sent with the adjustment, so sending the same one again cannot add it twice.
	let requestId = $state(generateToken());

	const correcting = new InPlaceForm();
	const adding = new InPlaceForm();

	const invalid = $derived(
		adjusting.failed?.kind === 'adjustment-invalid' ? adjusting.failed : null
	);

	// The server refuses a time still to come, so an end time ahead of now is no use as a seed.
	function arrivalSeed(): string {
		const now = new Date().toISOString();
		return endsAt && endsAt < now ? endsAt : now;
	}

	const formatTime = (iso: string) => (browser ? formatClockTime(iso, new Date()) : '');
	const signed = (points: number) => (points > 0 ? `+${points}` : `−${-points}`);

	const lateLine = $derived.by(() => {
		if (!team.arrivedAt) return 'Not arrived yet.';
		const at = `Arrived at ${formatTime(team.arrivedAt)}`;
		if (!endsAt) return `${at}. Set the end time to count minutes late.`;
		return team.minutesLate === 0 ? `${at}, on time.` : `${at}, ${team.minutesLate} min late.`;
	});

	function confirmFirst(question: string, submit: SubmitFunction): SubmitFunction {
		return (input) => {
			if (!confirm(question)) {
				input.cancel();
				return;
			}
			return submit(input);
		};
	}

	// Recording, clearing or removing swaps out the button that had focus.
	async function refocus(target: () => HTMLElement | null) {
		await tick();
		focusIfLost(target());
	}

	const record = arrival.submit(
		() => {
			toast.show('Arrival recorded');
			void refocus(() => correcting.opener);
		},
		undefined,
		recorded
	);

	const correct: SubmitFunction = (input) => {
		const local = input.formData.get('arrivedAtLocal');
		input.formData.set('arrivedAt', localInputToUtc(typeof local === 'string' ? local : '') ?? '');
		return arrival.submit(
			() => {
				void correcting.hide();
				toast.show('Arrival corrected');
			},
			undefined,
			corrected
		)(input);
	};

	const add = adjusting.submit(
		() => {
			requestId = generateToken();
			void adding.hide();
			toast.show('Adjustment added');
		},
		undefined,
		added
	);
</script>

<li class="flex flex-col gap-3 border-b py-4" aria-labelledby="{id}-name">
	<div class="flex items-center gap-3">
		<span class="min-w-12 shrink-0 type-rank">{ordinal(team.rank)}</span>
		<div class="min-w-0 flex-1">
			<h2 id="{id}-name" class="line-clamp-2 font-display type-heading break-words">
				{team.name}
			</h2>
			{#if team.members}<p class="line-clamp-2 type-secondary break-words">{team.members}</p>{/if}
		</div>
		<Points value={team.total} variant="total" />
	</div>

	<dl class="grid grid-cols-[1fr_auto] gap-x-4 type-secondary tabular-nums">
		<dt>Scored claims</dt>
		<dd class="text-right">{team.claimPoints}</dd>
		<dt>Adjustments</dt>
		<dd class="text-right">{team.adjustmentPoints === 0 ? 0 : signed(team.adjustmentPoints)}</dd>
		<dt>
			Late penalty{#if team.minutesLate > 0}, {team.minutesLate} min × {latePenaltyPerMinute}{/if}
		</dt>
		<dd class={['text-right', team.latePenalty > 0 && 'text-danger']}>
			{team.latePenalty === 0 ? 0 : signed(-team.latePenalty)}
		</dd>
	</dl>

	<section class="flex flex-col gap-2" aria-label="Arrival of {team.name}">
		<p>{lateLine}</p>
		{#if correcting.open}
			<form
				bind:this={correcting.form}
				method="POST"
				action="?/arrivalCorrect"
				tabindex="-1"
				aria-label="Set the arrival of {team.name}"
				class="flex flex-col gap-2 outline-none"
				use:enhance={correct}
			>
				<input type="hidden" name="teamId" value={team.id} />
				<Label for="{id}-arrived">Arrival time</Label>
				<!-- Input binds value, so a tracked seed would overwrite the typed time on every poll. -->
				<Input
					id="{id}-arrived"
					name="arrivedAtLocal"
					type="datetime-local"
					required
					value={untrack(() => utcToLocalInput(team.arrivedAt ?? arrivalSeed()))}
				/>
				<div class="flex gap-3">
					<Button variant="ghost" class="flex-1" onclick={correcting.hide}>Cancel</Button>
					<Button type="submit" class="flex-1" busy={arrival.busy}>Save time</Button>
				</div>
			</form>
		{:else}
			<div class="flex gap-3">
				{#if team.arrivedAt}
					<Button bind:ref={correcting.opener} class="flex-1" onclick={correcting.show}>
						Correct<span class="sr-only"> the arrival of {team.name}</span>
					</Button>
					<form
						method="POST"
						action="?/arrivalClear"
						class="flex flex-1"
						use:enhance={confirmFirst(
							`Clear the arrival of ${isolate(team.name)}? Its late penalty goes too.`,
							arrival.submit(
								() => {
									toast.show('Arrival cleared');
									void refocus(() => correcting.opener);
								},
								undefined,
								cleared
							)
						)}
					>
						<input type="hidden" name="teamId" value={team.id} />
						<Button type="submit" variant="destructive" class="flex-1" busy={arrival.busy}>
							Clear<span class="sr-only"> the arrival of {team.name}</span>
						</Button>
					</form>
				{:else}
					<form method="POST" action="?/arrivalRecord" class="flex flex-1" use:enhance={record}>
						<input type="hidden" name="teamId" value={team.id} />
						<Button type="submit" size="lg" class="flex-1" busy={arrival.busy}>
							Record arrival<span class="sr-only"> of {team.name}</span>
						</Button>
					</form>
					<Button bind:ref={correcting.opener} variant="ghost" onclick={correcting.show}>
						Enter time<span class="sr-only"> of arrival for {team.name}</span>
					</Button>
				{/if}
			</div>
		{/if}
		{#if arrival.error}
			<p class="text-[15px] text-danger" role="alert">{arrival.error}</p>
		{/if}
	</section>

	<section class="flex flex-col gap-2" aria-label="Adjustments of {team.name}">
		{#if team.adjustments.length > 0}
			<ul class="flex flex-col">
				{#each team.adjustments as adjustment (adjustment.id)}
					<li class="flex min-h-touch items-center gap-3">
						<span
							class={[
								'w-14 shrink-0 font-semibold tabular-nums',
								adjustment.points < 0 && 'text-danger'
							]}
						>
							{signed(adjustment.points)}
						</span>
						<span class="min-w-0 flex-1 break-words">
							<bdi>{adjustment.reason}</bdi>
							<span class="type-secondary">by <bdi>{adjustment.createdBy}</bdi></span>
						</span>
						<form
							method="POST"
							action="?/adjustmentRemove"
							use:enhance={confirmFirst(
								`Remove ${signed(adjustment.points)} for “${isolate(adjustment.reason)}”?`,
								adjusting.submit(
									() => {
										toast.show('Adjustment removed');
										void refocus(() => adding.opener);
									},
									undefined,
									removed
								)
							)}
						>
							<input type="hidden" name="adjustmentId" value={adjustment.id} />
							<Button
								type="submit"
								variant="ghost"
								size="icon"
								busy={adjusting.busy}
								aria-label="Remove {signed(adjustment.points)} for {adjustment.reason}"
							>
								<XIcon aria-hidden="true" />
							</Button>
						</form>
					</li>
				{/each}
			</ul>
		{/if}

		{#if adding.open}
			<form
				bind:this={adding.form}
				method="POST"
				action="?/adjustmentAdd"
				tabindex="-1"
				aria-label="Adjustment for {team.name}"
				class="flex flex-col gap-3 outline-none"
				use:enhance={add}
				oninput={() => (requestId = generateToken())}
			>
				<input type="hidden" name="teamId" value={team.id} />
				<input type="hidden" name="requestId" value={requestId} />
				<fieldset class="flex gap-3">
					<legend class="sr-only">Bonus or penalty</legend>
					<label class="flex min-h-touch flex-1 items-center gap-2">
						<input type="radio" name="sign" value="bonus" checked class="size-5" />
						Bonus
					</label>
					<label class="flex min-h-touch flex-1 items-center gap-2">
						<input type="radio" name="sign" value="penalty" class="size-5" />
						Penalty
					</label>
				</fieldset>
				<div class="flex flex-col gap-2">
					<Label for="{id}-points">Points</Label>
					<Input
						id="{id}-points"
						name="points"
						inputmode="numeric"
						autocomplete="off"
						required
						class="tabular-nums"
						aria-invalid={invalid?.errors.points ? true : undefined}
						aria-describedby={invalid?.errors.points ? `${id}-points-error` : undefined}
					/>
					{#if invalid?.errors.points}
						<p id="{id}-points-error" class="text-[15px] text-danger" role="alert">
							{invalid.errors.points}
						</p>
					{/if}
				</div>
				<div class="flex flex-col gap-2">
					<Label for="{id}-reason">Reason</Label>
					<Input
						id="{id}-reason"
						name="reason"
						required
						maxlength={REASON_MAX_LENGTH}
						autocomplete="off"
						placeholder="Best costume"
						aria-invalid={invalid?.errors.reason ? true : undefined}
						aria-describedby={invalid?.errors.reason ? `${id}-reason-error` : undefined}
					/>
					{#if invalid?.errors.reason}
						<p id="{id}-reason-error" class="text-[15px] text-danger" role="alert">
							{invalid.errors.reason}
						</p>
					{/if}
				</div>
				<div class="flex gap-3">
					<Button
						variant="ghost"
						class="flex-1"
						onclick={() => {
							void adding.hide();
							adjusting.clearError();
						}}
					>
						Cancel
					</Button>
					<Button type="submit" class="flex-1" busy={adjusting.busy}>Add</Button>
				</div>
			</form>
		{:else}
			<Button
				bind:ref={adding.opener}
				variant="ghost"
				class="-ml-4 self-start"
				onclick={adding.show}
			>
				Add adjustment<span class="sr-only"> for {team.name}</span>
			</Button>
		{/if}
		{#if adjusting.error}
			<p class="text-[15px] text-danger" role="alert">{adjusting.error}</p>
		{/if}
	</section>
</li>
