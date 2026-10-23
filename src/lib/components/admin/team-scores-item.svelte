<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { browser } from '$app/env';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { InPlaceForm } from '#lib/components/in-place-form.svelte.js';
	import { Points } from '#lib/components/points/index.js';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { formatClockTime } from '#lib/clock-time.js';
	import { localInputToUtc, utcToLocalInput } from '#lib/local-time.js';
	import { ordinal } from '#lib/ordinal.js';
	import { REASON_MAX_LENGTH } from '#lib/reason.js';
	import type { TeamScoresRow } from '#lib/server/judging-pages.js';
	import type { TeamScoresFormResult } from '#lib/server/team-scores.js';
	import { AdminAction } from './admin-action.svelte.js';

	type Props = {
		team: TeamScoresRow;
		endsAt: string | null;
		latePenaltyPerMinute: number;
	};

	let { team, endsAt, latePenaltyPerMinute }: Props = $props();

	const id = $props.id();
	const arrival = new AdminAction<TeamScoresFormResult>('teamScores');
	const adjusting = new AdminAction<TeamScoresFormResult>('teamScores');

	const correcting = new InPlaceForm();
	const adding = new InPlaceForm();

	const invalid = $derived(
		adjusting.failed?.kind === 'adjustment-invalid' ? adjusting.failed : null
	);
	const typedPoints = $derived(invalid?.values.points ?? '');
	const typedPenalty = $derived(typedPoints.startsWith('-'));

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

	const record = arrival.submit(() => toast.show('Arrival recorded'));

	const correct: SubmitFunction = (input) => {
		const local = input.formData.get('arrivedAtLocal');
		input.formData.set('arrivedAt', localInputToUtc(typeof local === 'string' ? local : '') ?? '');
		return arrival.submit(() => {
			void correcting.hide();
			toast.show('Arrival corrected');
		})(input);
	};

	const add: SubmitFunction = (input) => {
		const points = String(input.formData.get('magnitude') ?? '').trim();
		const penalty = input.formData.get('sign') === 'penalty';
		input.formData.set('points', penalty && points ? `-${points}` : points);
		return adjusting.submit(() => {
			void adding.hide();
			toast.show('Adjustment added');
		})(input);
	};
</script>

<li class="flex flex-col gap-3 border-b py-4" aria-labelledby="{id}-name">
	<div class="flex items-center gap-3">
		<span class="min-w-12 shrink-0 type-rank">{ordinal(team.rank)}</span>
		<div class="min-w-0 flex-1">
			<h2 id="{id}-name" class="truncate type-heading">{team.name}</h2>
			{#if team.members}<p class="truncate type-secondary">{team.members}</p>{/if}
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
				<Input
					id="{id}-arrived"
					name="arrivedAtLocal"
					type="datetime-local"
					required
					value={utcToLocalInput(team.arrivedAt ?? endsAt ?? new Date().toISOString())}
				/>
				<div class="flex gap-3">
					<Button variant="ghost" class="flex-1" onclick={correcting.hide}>Cancel</Button>
					<Button type="submit" class="flex-1" disabled={arrival.busy}>Save time</Button>
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
							`Clear the arrival of ${team.name}? Its late penalty goes too.`,
							arrival.submit(() => toast.show('Arrival cleared'))
						)}
					>
						<input type="hidden" name="teamId" value={team.id} />
						<Button type="submit" variant="destructive" class="flex-1" disabled={arrival.busy}>
							Clear<span class="sr-only"> the arrival of {team.name}</span>
						</Button>
					</form>
				{:else}
					<form method="POST" action="?/arrivalRecord" class="flex flex-1" use:enhance={record}>
						<input type="hidden" name="teamId" value={team.id} />
						<Button type="submit" size="lg" class="flex-1" disabled={arrival.busy}>
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
							{adjustment.reason}
							<span class="type-secondary">by {adjustment.createdBy}</span>
						</span>
						<form
							method="POST"
							action="?/adjustmentRemove"
							use:enhance={confirmFirst(
								`Remove ${signed(adjustment.points)} for “${adjustment.reason}”?`,
								adjusting.submit(() => toast.show('Adjustment removed'))
							)}
						>
							<input type="hidden" name="adjustmentId" value={adjustment.id} />
							<Button
								type="submit"
								variant="ghost"
								size="icon"
								disabled={adjusting.busy}
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
			>
				<input type="hidden" name="teamId" value={team.id} />
				<fieldset class="flex gap-3">
					<legend class="sr-only">Bonus or penalty</legend>
					<label class="flex min-h-touch flex-1 items-center gap-2">
						<input type="radio" name="sign" value="bonus" checked={!typedPenalty} class="size-5" />
						Bonus
					</label>
					<label class="flex min-h-touch flex-1 items-center gap-2">
						<input type="radio" name="sign" value="penalty" checked={typedPenalty} class="size-5" />
						Penalty
					</label>
				</fieldset>
				<div class="flex flex-col gap-2">
					<Label for="{id}-points">Points</Label>
					<Input
						id="{id}-points"
						name="magnitude"
						inputmode="numeric"
						autocomplete="off"
						required
						class="tabular-nums"
						value={typedPoints.replace(/^-/, '')}
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
						value={invalid?.values.reason ?? ''}
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
					<Button type="submit" class="flex-1" disabled={adjusting.busy}>Add</Button>
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
