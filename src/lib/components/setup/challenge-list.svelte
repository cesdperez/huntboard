<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { resultUnder } from '#lib/action-results.js';
	import { Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import type { ChallengeEditInput } from '#lib/domain/challenge-edit.js';
	import { plural } from '#lib/format/plural.js';
	import type { ChallengeWithClaimCount } from '#lib/server/db/types.js';
	import { groupBySection } from '#lib/format/group-by-section.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { challenges }: { challenges: ChallengeWithClaimCount[] } = $props();

	const result = $derived(resultUnder(page.form, 'challenges'));

	let editingId = $state<number | null>(null);
	let pending = $state(false);

	const submit: SubmitFunction = () => {
		pending = true;
		return async (settled) => {
			const { result } = settled;
			await updateOrRetry(settled);
			pending = false;
			if (result.type === 'success') editingId = null;
		};
	};

	function failure(id: number) {
		return result?.kind === 'edit-failed' && result.id === id ? result : null;
	}

	function values(challenge: ChallengeWithClaimCount): ChallengeEditInput {
		return (
			failure(challenge.id)?.values ?? {
				title: challenge.title,
				description: challenge.description ?? '',
				section: challenge.section ?? '',
				min: String(challenge.min_points),
				max: String(challenge.max_points)
			}
		);
	}

	function savedMessage(id: number) {
		if (result?.kind !== 'edited' || result.id !== id) return null;
		if (result.clampedCount === 0) return 'Saved.';
		return `Saved. ${plural(result.clampedCount, 'score')} moved into the new range.`;
	}
</script>

{#each groupBySection(challenges) as group, groupIndex (groupIndex)}
	<div class="flex flex-col">
		{#if group.section}
			<h3 class="pt-2 pb-1 font-display type-heading">{group.section}</h3>
		{/if}
		<ul class="flex flex-col border-t">
			{#each group.items as challenge (challenge.id)}
				{@const saved = savedMessage(challenge.id)}
				<li class="flex flex-col gap-1 border-b py-2">
					{#if editingId === challenge.id}
						{@const errors = failure(challenge.id)?.errors ?? {}}
						{@const current = values(challenge)}
						{@const id = `challenge-${challenge.id}`}
						<form
							method="POST"
							action="?/challengesEdit"
							class="flex flex-col gap-4 py-2"
							use:enhance={submit}
						>
							<input type="hidden" name="id" value={challenge.id} />
							<div class="flex flex-col gap-2">
								<Label for="{id}-title">Title</Label>
								<Input
									id="{id}-title"
									name="title"
									required
									value={untrack(() => current.title)}
									aria-invalid={errors.title ? true : undefined}
									aria-describedby={errors.title ? `${id}-title-error` : undefined}
								/>
								{#if errors.title}
									<p id="{id}-title-error" class="text-[15px] text-danger" role="alert">
										{errors.title}
									</p>
								{/if}
							</div>
							<div class="flex flex-col gap-2">
								<Label for="{id}-section">Section</Label>
								<Input id="{id}-section" name="section" value={untrack(() => current.section)} />
							</div>
							<div class="grid grid-cols-2 gap-3">
								<div class="flex flex-col gap-2">
									<Label for="{id}-min">Min points</Label>
									<Input
										id="{id}-min"
										name="min"
										inputmode="numeric"
										pattern="[0-9]*"
										required
										class="tabular"
										value={untrack(() => current.min)}
										aria-invalid={errors.min ? true : undefined}
										aria-describedby={errors.min ? `${id}-min-error` : undefined}
									/>
								</div>
								<div class="flex flex-col gap-2">
									<Label for="{id}-max">Max points</Label>
									<Input
										id="{id}-max"
										name="max"
										inputmode="numeric"
										pattern="[0-9]*"
										required
										class="tabular"
										value={untrack(() => current.max)}
										aria-invalid={errors.max ? true : undefined}
										aria-describedby={errors.max ? `${id}-max-error` : undefined}
									/>
								</div>
							</div>
							{#if errors.min}
								<p id="{id}-min-error" class="text-[15px] text-danger" role="alert">
									Min points: {errors.min}
								</p>
							{/if}
							{#if errors.max}
								<p id="{id}-max-error" class="text-[15px] text-danger" role="alert">
									Max points: {errors.max}
								</p>
							{/if}
							{#if challenge.claim_count > 0}
								<p class="type-secondary">Scores outside a new range move to its nearest end.</p>
							{/if}
							<div class="flex flex-col gap-2">
								<Label for="{id}-description">Description</Label>
								<textarea
									id="{id}-description"
									name="description"
									rows="3"
									value={current.description}
									class="w-full rounded-control border-2 border-input-line bg-surface px-3 py-2 text-ink focus-visible:border-ink"
								></textarea>
							</div>
							<div class="flex gap-3">
								<Button type="submit" class="flex-1" disabled={pending}>Save</Button>
								<Button variant="ghost" class="flex-1" onclick={() => (editingId = null)}>
									Cancel
								</Button>
							</div>
						</form>
					{:else}
						<div class="flex min-h-touch items-start gap-3">
							<div class="flex min-w-0 flex-1 flex-col gap-1 pt-2.5">
								<span class="break-words">{challenge.title}</span>
								{#if challenge.description}
									<span class="line-clamp-2 type-secondary whitespace-pre-line">
										{challenge.description}
									</span>
								{/if}
								{#if challenge.claim_count > 0}
									<span class="type-secondary">{plural(challenge.claim_count, 'claim')}</span>
								{/if}
							</div>
							<Points class="pt-3" min={challenge.min_points} max={challenge.max_points} />
							<Button
								variant="ghost"
								aria-label="Edit {challenge.title}"
								onclick={() => (editingId = challenge.id)}
							>
								Edit
							</Button>
						</div>
						{#if saved}
							<p class="type-secondary" role="status">{saved}</p>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/each}
