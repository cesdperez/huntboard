<script lang="ts">
	import { browser } from '$app/env';
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resultUnder } from '#lib/action-results.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { localInputToUtc, utcToLocalInput } from '#lib/format/local-time.js';
	import { THEMES, resolveTheme, supportedModes, type Theme } from '#lib/themes/index.js';
	import { GAME_NAME_MAX_LENGTH, LATE_PENALTY_MAX } from '#lib/domain/game-settings.js';
	import type { GameRow } from '#lib/server/db/types.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { game }: { game: GameRow } = $props();

	// Fields chain through these so a poll that replaces game with an equal object keeps what was
	// typed. A field derived from game directly reseeds on every new game object.
	const storedName = $derived(game.name);
	const storedPenalty = $derived(game.late_penalty_per_minute);
	const storedThemeId = $derived(resolveTheme(game.theme).id);
	const storedStartsAt = $derived(game.starts_at);
	const storedEndsAt = $derived(game.ends_at);

	let name = $derived(storedName);
	let penalty = $derived<number | null>(storedPenalty);
	let themeId = $derived(storedThemeId);
	// The server only knows UTC, so the wall clock is left empty until the browser renders it.
	let startsLocal = $derived(browser ? utcToLocalInput(storedStartsAt) : '');
	let endsLocal = $derived(browser ? utcToLocalInput(storedEndsAt) : '');

	const timeZone = browser ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

	let submitting = $state(false);
	const result = $derived(resultUnder(page.form, 'gameSettings'));
	const errors = $derived(result?.errors ?? {});

	function modeHint(theme: Theme): string {
		const modes = supportedModes(theme);
		if (modes.length > 1) return 'Light or dark, following the phone';
		return modes[0] === 'dark' ? 'Always dark' : 'Always light';
	}
</script>

{#snippet fieldError(id: string, message: string | undefined)}
	{#if message}
		<p {id} class="text-[15px] text-danger" role="alert">{message}</p>
	{/if}
{/snippet}

<section aria-labelledby="game-settings-heading" class="flex flex-col gap-3">
	<h2 id="game-settings-heading" class="font-display type-heading">Game</h2>

	<form
		method="POST"
		action="?/gameSettingsSave"
		class="flex flex-col gap-5"
		use:enhance={() => {
			submitting = true;
			return async (settled) => {
				await updateOrRetry(settled, { reset: false });
				submitting = false;
			};
		}}
	>
		<div class="flex flex-col gap-2">
			<Label for="game-name">Game name</Label>
			<Input
				id="game-name"
				name="name"
				required
				maxlength={GAME_NAME_MAX_LENGTH}
				bind:value={name}
				aria-invalid={errors.name ? true : undefined}
				aria-describedby={errors.name ? 'game-name-error' : undefined}
			/>
			{@render fieldError('game-name-error', errors.name)}
		</div>

		<fieldset class="flex flex-col gap-4">
			<legend class="sr-only">Game time</legend>
			{#if timeZone}
				<p class="type-secondary">Times are in your time zone, {timeZone}.</p>
			{/if}

			<div class="flex flex-col gap-2">
				<Label for="game-starts-at">Start</Label>
				<Input
					id="game-starts-at"
					type="datetime-local"
					disabled={!browser}
					bind:value={startsLocal}
					aria-invalid={errors.starts_at ? true : undefined}
					aria-describedby={errors.starts_at ? 'game-starts-at-error' : undefined}
				/>
				<!-- Without the browser's time zone there is no UTC to send, so the server keeps the stored time. -->
				{#if browser}
					<input type="hidden" name="starts_at" value={localInputToUtc(startsLocal) ?? ''} />
				{/if}
				{@render fieldError('game-starts-at-error', errors.starts_at)}
			</div>

			<div class="flex flex-col gap-2">
				<Label for="game-ends-at">End</Label>
				<Input
					id="game-ends-at"
					type="datetime-local"
					disabled={!browser}
					bind:value={endsLocal}
					aria-invalid={errors.ends_at ? true : undefined}
					aria-describedby={errors.ends_at ? 'game-ends-at-error' : undefined}
				/>
				<!-- Without the browser's time zone there is no UTC to send, so the server keeps the stored time. -->
				{#if browser}
					<input type="hidden" name="ends_at" value={localInputToUtc(endsLocal) ?? ''} />
				{/if}
				{@render fieldError('game-ends-at-error', errors.ends_at)}
			</div>
		</fieldset>

		<div class="flex flex-col gap-2">
			<Label for="game-late-penalty">Late penalty per minute</Label>
			<p id="game-late-penalty-hint" class="type-secondary">
				Points a team loses for each whole minute it arrives after the end.
			</p>
			<Input
				id="game-late-penalty"
				name="late_penalty_per_minute"
				type="number"
				inputmode="numeric"
				min={0}
				max={LATE_PENALTY_MAX}
				step={1}
				required
				class="tabular-nums"
				bind:value={penalty}
				aria-invalid={errors.late_penalty_per_minute ? true : undefined}
				aria-describedby={errors.late_penalty_per_minute
					? 'game-late-penalty-hint game-late-penalty-error'
					: 'game-late-penalty-hint'}
			/>
			{@render fieldError('game-late-penalty-error', errors.late_penalty_per_minute)}
		</div>

		<fieldset
			class="flex flex-col gap-2"
			aria-describedby={errors.theme ? 'game-theme-hint game-theme-error' : 'game-theme-hint'}
		>
			<legend class="mb-2 font-semibold">Theme</legend>
			<p id="game-theme-hint" class="type-secondary">
				How every page of this game looks, these admin pages too.
			</p>
			{#each THEMES as theme (theme.id)}
				<label class="flex min-h-touch items-center gap-3">
					<input
						type="radio"
						name="theme"
						value={theme.id}
						bind:group={themeId}
						class="size-5 shrink-0"
					/>
					<span class="flex flex-col">
						{theme.name}
						<span class="type-secondary">{modeHint(theme)}</span>
					</span>
				</label>
			{/each}
			{@render fieldError('game-theme-error', errors.theme)}
		</fieldset>

		<div class="flex items-center gap-4">
			<Button type="submit" size="lg" busy={submitting}>Save game</Button>
			<p class="type-secondary" role="status">{result?.saved ? 'Saved.' : ''}</p>
		</div>
	</form>
</section>
