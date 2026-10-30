<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { resultUnder } from '#lib/action-results.js';
	import { Points } from '#lib/components/points/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { plural } from '#lib/format/plural.js';
	import { groupBySection } from '#lib/format/group-by-section.js';
	import type { ImportPreviewRow } from '#lib/domain/challenge-import.js';
	import type { ChallengeWithClaimCount } from '#lib/server/db/types.js';
	import { challengesImported } from './setup-checks.js';
	import { updateOrRetry } from './update-or-retry.js';

	const EXAMPLE = `# Around town

- Make a birthday card [5-20]
  Judged on effort. A napkin counts, but barely.
- Pick up a free item from Marktplaats and deliver it by bike [30-100]
  Bigger and more awkward scores higher.
- Swim in a fountain [25]

# Food

- Get a free dessert from a restaurant [10-15]
- Eat something you have never tried [5-10]`;

	const CHANGE_LABELS: Record<ImportPreviewRow['change'], string> = {
		new: 'New',
		updated: 'Updated',
		unchanged: 'Unchanged'
	};

	const IMPORTED_ID = 'challenges-imported';

	let {
		hasChallenges,
		challenges
	}: { hasChallenges: boolean; challenges: ChallengeWithClaimCount[] } = $props();

	const result = $derived(resultUnder(page.form, 'challenges'));
	const previewResult = $derived(result?.kind === 'preview' ? result : null);
	const preview = $derived(previewResult?.preview ?? null);
	const imported = $derived(result?.kind === 'imported' ? result.count : null);

	const initial = resultUnder(page.form, 'challenges');
	// A first list starts from the example, so the format can be learned by editing it.
	let text = $state(
		initial?.kind === 'preview' ? initial.text : untrack(() => (hasChallenges ? '' : EXAMPLE))
	);
	let pending = $state(false);

	const stale = $derived(previewResult !== null && previewResult.text !== text);
	const deletedClaimCount = $derived(
		preview?.deletedWithClaims.reduce((sum, { claimCount }) => sum + claimCount, 0) ?? 0
	);
	const canImport = $derived(
		preview !== null && preview.errors.length === 0 && preview.rows.length > 0 && !stale
	);

	// A preview changes nothing, so only an import is checked after a lost answer.
	const submit: SubmitFunction = ({ formData, action }) => {
		pending = true;
		const importing = action.search.includes('challengesImport');
		const tookEffect = () =>
			challengesImported(challenges, formData) && {
				challenges: { kind: 'imported', count: challenges.length }
			};
		return async (settled) => {
			const result = await updateOrRetry(settled, {
				reset: false,
				tookEffect: importing ? tookEffect : undefined
			});
			pending = false;
			const answer = result.type === 'success' ? resultUnder(result.data, 'challenges') : null;
			if (answer?.kind === 'imported') {
				text = '';
				// The Import button left with the preview. A first import also remounts this component.
				await tick();
				document.getElementById(IMPORTED_ID)?.focus();
			}
		};
	};

	const summary = $derived.by(() => {
		if (!preview || preview.rows.length === 0) return null;
		const count = (change: ImportPreviewRow['change']) =>
			preview.rows.filter((row) => row.change === change).length;
		const counts: [number, string][] = [
			[count('new'), 'new challenge'],
			[count('updated'), 'update'],
			[preview.deleted.length + preview.deletedWithClaims.length, 'delete']
		];
		const parts = counts.filter(([count]) => count > 0).map(([count, noun]) => plural(count, noun));
		if (preview.reordered) parts.push('a new order');
		return parts.length > 0 ? `${parts.join(', ')}.` : 'No changes.';
	});

	const announcement = $derived.by(() => {
		// Empty while a request runs, so the same summary twice is still read out.
		if (!preview || pending) return '';
		if (preview.errors.length > 0) {
			return `Preview: ${plural(preview.errors.length, 'line')} could not be read.`;
		}
		return `Preview: ${summary ?? 'No challenges in the list.'}`;
	});
</script>

<form method="POST" action="?/challengesPreview" class="flex flex-col gap-3" use:enhance={submit}>
	<div class="flex flex-col gap-2">
		<Label for="challenge-text">{hasChallenges ? 'Replace the list' : 'Paste your list'}</Label>
		<p id="challenge-text-hint" class="type-secondary">
			One challenge per line, starting with a dash. Points go at the end in square brackets, like
			[10] or [5-20]. A line starting with # starts a section. Lines under a challenge are its
			description.
			{#if !hasChallenges}Edit the example or replace it with your own list.{/if}
		</p>
		<textarea
			id="challenge-text"
			name="text"
			rows="10"
			bind:value={text}
			aria-describedby="challenge-text-hint"
			aria-invalid={previewResult?.error && !preview ? true : undefined}
			class="min-h-48 w-full rounded-control border-2 border-input-line bg-surface px-3 py-2 text-ink placeholder:text-muted focus-visible:border-ink aria-invalid:border-danger"
			placeholder={EXAMPLE}></textarea>
	</div>
	<Button type="submit" disabled={text.trim() === ''} busy={pending}>Preview</Button>
</form>

<p class="sr-only" aria-live="polite">{announcement}</p>

{#if imported !== null}
	<p id={IMPORTED_ID} tabindex="-1" class="type-secondary" role="status">
		Imported {plural(imported, 'challenge')}.
	</p>
{/if}

{#if previewResult?.error}
	<p class="text-[15px] text-danger" role="alert">{previewResult.error}</p>
{/if}

{#if preview}
	<div class="flex flex-col gap-4" aria-labelledby="challenge-preview-heading" role="region">
		<h3 id="challenge-preview-heading" class="font-display type-heading">Preview</h3>

		{#if stale}
			<p class="text-[15px] text-danger" role="alert">
				The list changed since this preview. Preview again before importing.
			</p>
		{/if}

		{#if preview.errors.length > 0}
			<div class="flex flex-col gap-2">
				<p class="text-[15px] text-danger">
					{plural(preview.errors.length, 'line')} could not be read. Fix the list and preview again.
				</p>
				<ul class="flex flex-col border-t border-danger/40">
					{#each preview.errors as error (error.line)}
						<li class="flex flex-col gap-1 border-b border-danger/40 py-2">
							<span class="text-[15px]">
								<span class="font-semibold tabular">Line {error.line}:</span>
								{error.message}
							</span>
							<code class="type-secondary break-words whitespace-pre-wrap">{error.source}</code>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if summary}
			<p class="type-secondary">{summary}</p>
		{/if}

		{#if preview.deleted.length > 0}
			<p class="type-secondary break-words">
				Not in the new list, deleted: {#each preview.deleted as title, index (index)}{#if index > 0},
					{/if}<bdi>{title}</bdi>{/each}.
			</p>
		{/if}

		{#if preview.deletedWithClaims.length > 0}
			<div class="flex flex-col gap-2 rounded-control border-2 border-danger p-3">
				<p class="text-[15px] text-danger">
					These challenges are not in the new list but have claims. Importing deletes them and their {plural(
						deletedClaimCount,
						'claim'
					)}.
				</p>
				<ul class="flex flex-col gap-1">
					{#each preview.deletedWithClaims as deleted (deleted.id)}
						<li class="text-[15px] break-words">
							<bdi>{deleted.title}</bdi><span class="text-muted"
								>, {plural(deleted.claimCount, 'claim')}</span
							>
						</li>
					{/each}
				</ul>
				<p class="type-secondary">To fix a typo in a title, edit that challenge instead.</p>
			</div>
		{/if}

		{#if preview.clampedScores.length > 0}
			<div class="flex flex-col gap-2">
				<p class="text-[15px]">These scores move into the new range:</p>
				<ul class="flex flex-col gap-1">
					{#each preview.clampedScores as clamped, index (index)}
						<li class="text-[15px] break-words">
							<bdi>{clamped.teamName}</bdi>, <bdi>{clamped.title}</bdi>:
							<span class="tabular">{clamped.from} to {clamped.to}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#if preview.rows.length > 0}
			<table class="w-full border-collapse text-left">
				<thead class="sr-only">
					<tr>
						<th scope="col">Challenge</th>
						<th scope="col">Points</th>
					</tr>
				</thead>
				{#each groupBySection(preview.rows) as group, groupIndex (groupIndex)}
					<tbody>
						{#if group.section}
							<tr>
								<th scope="rowgroup" colspan="2" class="pt-4 pb-1 font-display type-heading">
									{group.section}
								</th>
							</tr>
						{/if}
						{#each group.items as row (row.title)}
							<tr class="border-t">
								<td class="py-3 pr-3 align-top wrap-anywhere">
									<span class="block">{row.title}</span>
									<span class="block type-secondary">
										{CHANGE_LABELS[row.change]}
									</span>
									{#if row.description}
										<span class="block type-secondary whitespace-pre-line">{row.description}</span>
									{/if}
								</td>
								<td class="py-3 text-right align-top">
									<Points min={row.min_points} max={row.max_points} />
								</td>
							</tr>
						{/each}
					</tbody>
				{/each}
			</table>
		{/if}

		<form
			method="POST"
			action="?/challengesImport"
			class="flex flex-col gap-2"
			use:enhance={submit}
		>
			<input type="hidden" name="text" value={previewResult?.text ?? ''} />
			{#each preview.deletedWithClaims as deleted (deleted.id)}
				<input type="hidden" name="acknowledged" value="{deleted.id}:{deleted.claimCount}" />
			{/each}
			<Button type="submit" variant="primary" size="lg" disabled={!canImport} busy={pending}>
				{#if deletedClaimCount > 0}
					Import and delete {plural(deletedClaimCount, 'claim')}
				{:else}
					Import {plural(preview.rows.length, 'challenge')}
				{/if}
			</Button>
		</form>
	</div>
{/if}
