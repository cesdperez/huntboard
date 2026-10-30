<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { GameRow } from '#lib/server/db/types.js';
	import { updateOrRetry } from './update-or-retry.js';

	let { game, mediaCount }: { game: GameRow; mediaCount: number } = $props();

	let pending = $state(false);
	// Offered only after a download in this visit, so nobody deletes what they never saved.
	let downloaded = $state(false);

	const remove: SubmitFunction = ({ cancel }) => {
		const warning = `Delete all media of ${game.name}? This deletes every photo and video teams sent. Claims and scores stay. It cannot be undone. Wait until the download has finished.`;
		if (!confirm(warning)) return cancel();
		pending = true;
		return async (settled) => {
			await updateOrRetry(settled);
			pending = false;
			if (settled.result.type === 'success') toast.show('Media deleted');
		};
	};
</script>

<section aria-labelledby="claim-media-heading" class="flex flex-col gap-3">
	<h2 id="claim-media-heading" class="font-display type-heading">Claim media</h2>
	<p class="type-secondary">
		{#if mediaCount === 0}
			No claim has a photo or video.
		{:else}
			{mediaCount === 1 ? '1 claim has' : `${mediaCount} claims have`} a photo or video. Download them
			to keep them: media is deleted 30 days after upload.
		{/if}
	</p>
	{#if mediaCount > 0}
		<Button
			href={resolve('/a/[token]/media.zip', { token: game.admin_token })}
			download
			class="w-full"
			onclick={() => (downloaded = true)}
		>
			Download all media
		</Button>
	{/if}
	{#if downloaded || mediaCount === 0}
		<form method="POST" action="?/mediaDeleteAll" use:enhance={remove}>
			<Button type="submit" variant="destructive" class="w-full" busy={pending}>
				Delete all media
			</Button>
		</form>
	{:else}
		<p class="type-secondary">"Delete all media" shows here once you download it.</p>
	{/if}
</section>
