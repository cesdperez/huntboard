<script lang="ts" module>
	/** A claim in the state the judge saw it, or an open cell to score without a claim. */
	export type JudgeTarget =
		{ claimId: number; from: 'pending' | 'scored' } | { teamId: number; challengeId: number };
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { clampPoints, parsePoints, quickPointValues } from '#lib/domain/points.js';
	import { REASON_MAX_LENGTH } from '#lib/reason.js';
	import type { JudgeFormResult } from '#lib/server/judging.js';
	import { AdminAction } from './admin-action.svelte.js';

	type Props = {
		/** The claim as the last refresh shows it. An error shows only while it stays the same. */
		target: JudgeTarget;
		min: number;
		max: number;
		/** Names what is judged for screen readers, e.g. "Canal Rats, Swim in a fountain". */
		label: string;
		/** Score is the sheet's primary action. In the queue every item has one, so none is. */
		primary?: boolean;
		/** Gets every error instead of showing it here, for a parent that keeps the item in view. */
		onfailure?: (message: string) => void;
		ondone?: () => void;
	};

	let { target, min, max, label, primary = false, onfailure, ondone }: Props = $props();

	const id = $props.id();
	const range = $derived({ min, max });
	const action = new AdminAction<JudgeFormResult>('judge', () => JSON.stringify(target));

	// A tap acts on the state the judge saw when the panel opened or the last answer came, never
	// on one a poll swapped in meanwhile. A change in between gets the server's conflict message.
	let seen = $state(untrack(() => target));
	const claimTarget = $derived('claimId' in seen ? seen : null);
	let mounted = true;
	$effect(() => () => (mounted = false));

	let rejecting = $state(false);

	function submit(): SubmitFunction {
		const send = action.submit(
			(result) => {
				toast.show(result.kind === 'scored' ? `Scored ${result.points}` : 'Rejected');
				rejecting = false;
				ondone?.();
			},
			(message) => onfailure?.(message)
		);
		return async (input) => {
			const settle = await send(input);
			return async (options) => {
				await settle?.(options);
				// The refresh can remove this panel, and reading its props then warns of stale values.
				if (mounted) seen = target;
			};
		};
	}

	function clampTyped(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const points = parsePoints(input.value);
		if (points !== null) input.value = String(clampPoints(points, range));
	}
</script>

{#snippet targetFields()}
	{#if claimTarget}
		<input type="hidden" name="claimId" value={claimTarget.claimId} />
		<input type="hidden" name="from" value={claimTarget.from} />
	{:else if 'teamId' in seen}
		<input type="hidden" name="teamId" value={seen.teamId} />
		<input type="hidden" name="challengeId" value={seen.challengeId} />
	{/if}
{/snippet}

<div class="flex flex-col gap-3">
	{#if rejecting && claimTarget}
		<form method="POST" action="?/judgeReject" class="flex flex-col gap-3" use:enhance={submit()}>
			{@render targetFields()}
			<div class="flex flex-col gap-2">
				<Label for="{id}-reason">
					Reason <span class="font-normal text-muted">(optional, the team sees it)</span>
				</Label>
				<Input
					id="{id}-reason"
					name="reason"
					maxlength={REASON_MAX_LENGTH}
					autocomplete="off"
					placeholder="No proof received"
				/>
			</div>
			{#if !onfailure && action.error}
				<p class="text-[15px] text-danger" role="alert">{action.error}</p>
			{/if}
			<div class="flex gap-3">
				<Button variant="ghost" class="flex-1" onclick={() => (rejecting = false)}>Cancel</Button>
				<Button type="submit" variant="destructive" class="flex-1" disabled={action.busy}>
					Reject claim<span class="sr-only">{` ${label}`}</span>
				</Button>
			</div>
		</form>
	{:else}
		<div class="flex gap-2">
			<form
				method="POST"
				action={claimTarget ? '?/judgeScore' : '?/judgeScoreOpen'}
				class="flex flex-1 gap-2"
				use:enhance={submit()}
			>
				{@render targetFields()}
				{#each quickPointValues(range) as points (points)}
					<Button
						type="submit"
						name="points"
						value={String(points)}
						size="lg"
						class="flex-1 px-2 tabular-nums"
						disabled={action.busy}
						aria-label="Score {points} for {label}"
					>
						{points}
					</Button>
				{/each}
			</form>
			<Input
				form="{id}-custom"
				name="points"
				inputmode="numeric"
				autocomplete="off"
				required
				class="min-h-row w-24 shrink-0 px-2 text-center tabular-nums"
				placeholder={min === max ? String(min) : `${min}–${max}`}
				aria-label="Other points for {label}, {min} to {max}"
				onchange={clampTyped}
			/>
		</div>
		<form
			id="{id}-custom"
			method="POST"
			action={claimTarget ? '?/judgeScore' : '?/judgeScoreOpen'}
			class="flex gap-3"
			use:enhance={submit()}
		>
			{@render targetFields()}
			{#if claimTarget}
				<Button
					variant="destructive"
					class="flex-1"
					disabled={action.busy}
					onclick={() => (rejecting = true)}
				>
					Reject<span class="sr-only">{` ${label}`}</span>
				</Button>
			{/if}
			<Button
				type="submit"
				variant={primary ? 'primary' : 'secondary'}
				class="flex-1"
				disabled={action.busy}
			>
				Score<span class="sr-only">{` ${label}`}</span>
			</Button>
		</form>
		{#if !onfailure && action.error}
			<p class="text-[15px] text-danger" role="alert">{action.error}</p>
		{/if}
	{/if}
</div>
