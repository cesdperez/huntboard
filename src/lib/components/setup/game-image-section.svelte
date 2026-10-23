<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { page } from '$app/state';
	import { resultUnder } from '#lib/action-results.js';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { GAME_IMAGE_SPEC, resizeImage } from '#lib/client/image-resize.js';
	import { IMAGE_LABEL_MAX_LENGTH, imageSrc } from '#lib/domain/images.js';
	import type { GameRow } from '#lib/server/db/types.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { game }: { game: GameRow } = $props();

	// Reassigned from game after each save, and kept as typed after a failed one.
	let label = $derived(game.image_label);
	let fileInput = $state<HTMLInputElement | null>(null);
	let submitting = $state(false);
	let browserError = $state<string | null>(null);

	const result = $derived(resultUnder(page.form, 'gameImage'));
	const error = $derived(browserError ?? result?.error ?? null);

	const save: SubmitFunction = async ({ formData, cancel }) => {
		browserError = null;
		submitting = true;
		const file = formData.get('image');
		if (file instanceof File && file.size > 0) {
			const resized = await resizeImage(file, GAME_IMAGE_SPEC);
			if (!resized.ok) {
				browserError = resized.message;
				submitting = false;
				return cancel();
			}
			formData.set('image', resized.image);
		}
		return async (settled) => {
			await updateOrRetry(settled, { reset: false });
			submitting = false;
			if (settled.result.type === 'success' && fileInput) fileInput.value = '';
		};
	};

	const remove: SubmitFunction = ({ cancel }) => {
		if (!confirm('Remove the game image? Players and the scoreboard stop showing it.')) {
			return cancel();
		}
		submitting = true;
		return async (settled) => {
			await updateOrRetry(settled);
			submitting = false;
			if (settled.result.type === 'success') toast.show('Image removed');
		};
	};
</script>

<section aria-labelledby="game-image-heading" class="flex flex-col gap-3">
	<h2 id="game-image-heading" class="font-display type-heading">Game image</h2>
	<p class="type-secondary">
		An invitation, poster or map. Players see it at the top of their page, and so does the
		scoreboard.
	</p>

	{#if game.image_key}
		<img
			src={imageSrc(game.image_key)}
			alt={game.image_label || 'The game image'}
			class="max-h-48 max-w-full self-start rounded-sm border object-contain"
		/>
	{/if}

	<form
		method="POST"
		action="?/gameImageSave"
		enctype="multipart/form-data"
		class="flex flex-col gap-5"
		use:enhance={save}
	>
		<div class="flex flex-col gap-2">
			<Label for="game-image-file">{game.image_key ? 'Replace image' : 'Image'}</Label>
			<input
				bind:this={fileInput}
				id="game-image-file"
				name="image"
				type="file"
				accept="image/*"
				class="min-h-touch w-full text-[15px] text-muted file:mr-3 file:min-h-touch file:rounded-control file:border-2 file:border-ink file:bg-transparent file:px-4 file:text-[17px] file:font-semibold file:text-ink"
				aria-describedby={error ? 'game-image-error' : undefined}
			/>
		</div>

		<div class="flex flex-col gap-2">
			<Label for="game-image-label">
				Label <span class="font-normal text-muted">(optional)</span>
			</Label>
			<Input
				id="game-image-label"
				name="label"
				maxlength={IMAGE_LABEL_MAX_LENGTH}
				placeholder="Birthday invitation"
				bind:value={label}
			/>
		</div>

		{#if error}
			<p id="game-image-error" class="text-[15px] text-danger" role="alert">{error}</p>
		{/if}

		<div class="flex items-center gap-4">
			<Button type="submit" size="lg" disabled={submitting}>Save image</Button>
			<p class="type-secondary" role="status">{result?.saved ? 'Saved.' : ''}</p>
		</div>
	</form>

	{#if game.image_key}
		<form method="POST" action="?/gameImageRemove" use:enhance={remove}>
			<Button type="submit" variant="destructive" class="w-full" disabled={submitting}>
				Remove image
			</Button>
		</form>
	{/if}
</section>
