<script lang="ts">
	import type { ClaimMedia } from '#lib/domain/claim-media.js';

	type Props = {
		media: ClaimMedia;
		/** What it shows, e.g. "Canal Rats, Swim in a fountain". */
		label: string;
	};

	let { media, label }: Props = $props();
</script>

<!-- Bounded height, so the judging buttons stay within reach under a tall photo. -->
{#if media.kind === 'photo'}
	<!-- A file, not a page: media.src comes from mediaSrc(). -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href={media.src}
		target="_blank"
		rel="noopener"
		class="block self-stretch rounded-sm border bg-paper"
		aria-label="Open the photo from {label} in full"
	>
		<img
			src={media.src}
			alt="Photo from {label}"
			decoding="async"
			class="mx-auto max-h-64 w-full rounded-sm object-contain"
		/>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<!-- Team clips come without captions to offer. -->
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		src={media.src}
		controls
		playsinline
		preload="metadata"
		aria-label="Video from {label}"
		class="max-h-64 w-full self-stretch rounded-sm bg-ink"
	></video>
{/if}
