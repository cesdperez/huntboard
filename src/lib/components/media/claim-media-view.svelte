<script lang="ts">
	import type { ClaimMedia } from '#lib/domain/claim-media.js';

	type Props = {
		media: ClaimMedia;
		/** What it shows, e.g. "Canal Rats, Swim in a fountain". */
		label: string;
		/** `none` where many videos list at once, since each metadata read is a Worker request. */
		preload: 'none' | 'metadata';
	};

	let { media, label, preload }: Props = $props();

	let loaded = $state(false);
</script>

<!-- Bounded height, so the judging buttons stay within reach under a tall photo. A photo not
	loaded yet takes that height too: at no height, a long queue would fit inside the browser's
	lazy-loading distance and load every photo at once. -->
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
			loading="lazy"
			class={['mx-auto w-full rounded-sm object-contain', loaded ? 'max-h-64' : 'h-64']}
			onload={() => (loaded = true)}
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
		{preload}
		aria-label="Video from {label}"
		class="max-h-64 w-full self-stretch rounded-sm bg-ink"
	></video>
{/if}
