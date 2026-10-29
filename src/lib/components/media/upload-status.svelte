<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import type { MediaKind } from '#lib/domain/claim-media.js';
	import type { UploadPhase } from '#lib/components/team/claim-media-upload.svelte.js';
	import MediaThumb from './media-thumb.svelte';

	type Props = {
		phase: Exclude<UploadPhase, 'idle'>;
		kind: MediaKind;
		progress: number | null;
		preview: string | null;
		error: string | null;
		onremove: () => void;
	};

	let { phase, kind, progress, preview, error, onremove }: Props = $props();

	const noun = $derived(kind === 'video' ? 'video' : 'photo');
	const label = $derived.by(() => {
		switch (phase) {
			case 'preparing':
				return kind === 'video' ? 'Compressing video' : 'Shrinking photo';
			case 'uploading':
				return 'Uploading';
			case 'ready':
				return kind === 'video' ? 'Video attached' : 'Photo attached';
			case 'failed':
				return `The ${noun} is not attached`;
		}
	});
	const running = $derived(phase === 'preparing' || phase === 'uploading');
	const percent = $derived(progress === null ? null : Math.round(progress * 100));
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-3">
		<MediaThumb {kind} src={preview} class="size-14" />
		<div class="flex min-w-0 flex-1 flex-col gap-1.5">
			<p class="flex justify-between gap-2" aria-live="polite">
				<span class="font-semibold">{label}</span>
				{#if running && percent !== null}<span class="text-muted tabular">{percent}%</span>{/if}
			</p>
			{#if running}
				<div
					role="progressbar"
					aria-label={label}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={percent ?? undefined}
					class="h-1.5 overflow-hidden rounded-full bg-line"
				>
					{#if percent === null}
						<div class="h-full w-full bg-ink/40 motion-safe:animate-pulse"></div>
					{:else}
						<div class="h-full bg-ink transition-[width]" style:width="{percent}%"></div>
					{/if}
				</div>
			{/if}
		</div>
		<Button variant="ghost" class="px-3" onclick={onremove}>
			Remove<span class="sr-only">{` ${noun}`}</span>
		</Button>
	</div>
	{#if error}
		<p class="text-[15px] text-danger" role="alert">{error}</p>
	{/if}
</div>
