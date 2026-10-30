<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import { GameImageSheet } from '#lib/components/images/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { GameImage } from '#lib/domain/images.js';
	import { splitLastWord } from '#lib/format/text.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		name: string;
		/** The start day, null until the browser clock runs or without a start time. */
		day: string | null;
		countdown: string | null;
		image: GameImage | null;
		/** Makes the game name the page's h1. */
		heading?: boolean;
		class?: string;
	};

	let { name, day, countdown, image, heading = false, class: className }: Props = $props();

	// Longer game names take a smaller title, so they wrap into a few lines, not a column of words.
	const LONG_NAME = 16;
	const LONGER_NAME = 40;

	// The last word gets its own span, which a theme may set apart, like an italic second line.
	const title = $derived(splitLastWord(name));

	let open = $state(false);
</script>

<section class={cn('event-banner surface-banner', className)}>
	<div
		class="event-banner-grid mx-auto max-w-content gap-x-3 gap-y-2 px-gutter py-4"
		data-image={image ? '' : undefined}
	>
		{#if image}
			<!-- A second way to open the sheet for thumbs, hidden from keyboards and screen readers,
			     which get the View button. -->
			<button
				type="button"
				tabindex="-1"
				aria-hidden="true"
				class="event-banner-thumb overflow-hidden rounded-sm border-2 border-ink"
				onclick={() => (open = true)}
			>
				<img src={image.src} alt="" decoding="async" class="size-full object-cover object-top" />
			</button>
		{/if}
		<svelte:element
			this={heading ? 'h1' : 'p'}
			class="event-banner-title banner-glyph-room self-end type-banner break-words hyphens-auto"
			data-long={name.length > LONG_NAME || undefined}
			data-longer={name.length > LONGER_NAME || undefined}
			title={name}
		>
			{#if title}
				{title.head} <span class="event-banner-title-tail">{title.tail}</span>
			{:else}
				{name}
			{/if}
		</svelte:element>
		<div class="event-banner-art" aria-hidden="true"></div>
		<div class="event-banner-meta flex flex-col text-[17px] leading-snug font-semibold">
			{#if day}
				<p class="flex items-center gap-2">
					<CalendarDaysIcon aria-hidden="true" class="event-banner-icon size-5 shrink-0" />
					{day}
				</p>
			{/if}
			<p class="flex items-center gap-2 tabular-nums">
				<ClockIcon aria-hidden="true" class="event-banner-icon size-5 shrink-0" />
				{countdown ?? ' '}
			</p>
		</div>
		{#if image}
			<Button class="event-banner-view min-w-0 justify-between" onclick={() => (open = true)}>
				<span class="truncate">View <bdi>{image.label}</bdi></span>
				<ChevronRightIcon aria-hidden="true" />
			</Button>
		{/if}
	</div>
</section>

{#if image}
	<GameImageSheet {image} bind:open />
{/if}

<style>
	.event-banner-grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 72px;
		grid-template-areas:
			'title art'
			'meta art';
	}

	.event-banner-grid[data-image] {
		grid-template-columns: auto minmax(0, 1fr) 48px;
		grid-template-areas:
			'thumb title title'
			'thumb meta art'
			'thumb view view';
	}

	.event-banner-thumb {
		grid-area: thumb;
		align-self: start;
		width: 96px;
		height: 120px;
	}

	/* Three lines at most, so a long name leaves the strip and the list on the first screen. */
	.event-banner-title {
		grid-area: title;
		font-size: var(--banner-title-size);
		line-height: var(--banner-title-leading);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}

	.event-banner-title-tail {
		display: var(--banner-title-tail-display);
		font-style: var(--banner-title-tail-style);
		font-weight: var(--banner-title-tail-weight);
	}

	.event-banner-title[data-long] {
		font-size: 40px;
	}

	.event-banner-title[data-longer] {
		font-size: 30px;
	}

	.event-banner-meta {
		grid-area: meta;
	}

	.event-banner-grid :global(.event-banner-view) {
		grid-area: view;
	}

	/* Its own column, so the theme's drawing never sits behind text or a button. */
	.event-banner-art {
		grid-area: art;
		background: var(--banner-art) no-repeat bottom right / contain;
	}
</style>
