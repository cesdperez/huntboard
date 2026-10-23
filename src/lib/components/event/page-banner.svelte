<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** The page's h1, set in the banner font. */
		title: string;
		/** A line under the title. */
		children?: Snippet;
	};

	let { title, children }: Props = $props();
</script>

<!-- The event banner for a page without a game: no image, no clock. -->
<section class="surface-banner">
	<div class="page-banner-grid mx-auto max-w-content gap-x-3 gap-y-2 px-gutter py-5">
		<h1 class="page-banner-title self-end font-banner leading-[0.85] break-words uppercase">
			{title}
		</h1>
		{#if children}
			<div class="page-banner-text text-[17px] leading-snug font-semibold">
				{@render children()}
			</div>
		{/if}
		<div class="page-banner-art" aria-hidden="true"></div>
	</div>
</section>

<style>
	.page-banner-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 64px;
		grid-template-areas:
			'title art'
			'text art';
	}

	.page-banner-title {
		grid-area: title;
		font-size: clamp(48px, 15vw, 72px);
	}

	.page-banner-text {
		grid-area: text;
	}

	.page-banner-art {
		grid-area: art;
		min-height: 96px;
		background: var(--banner-art) no-repeat bottom right / contain;
	}
</style>
