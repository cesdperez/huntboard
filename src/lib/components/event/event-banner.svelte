<script lang="ts">
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import { GameImageSheet } from '#lib/components/images/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { GameImage } from '#lib/images.js';
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

	let open = $state(false);
</script>

<section class={cn('event-banner surface-banner', className)}>
	<div
		class="event-banner-grid mx-auto max-w-content gap-x-3 gap-y-2 px-gutter py-4"
		data-image={image ? '' : undefined}
	>
		{#if image}
			<img
				src={image.src}
				alt=""
				decoding="async"
				class="event-banner-thumb h-30 w-24 rounded-sm border-2 border-ink object-cover object-top"
			/>
		{/if}
		<svelte:element
			this={heading ? 'h1' : 'p'}
			class="event-banner-title self-end font-banner text-[44px] leading-[0.9] break-words uppercase"
		>
			{name}
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
				<span class="truncate">View {image.label}</span>
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
			'thumb title art'
			'thumb meta art'
			'thumb view view';
	}

	.event-banner-thumb {
		grid-area: thumb;
		align-self: start;
	}

	.event-banner-title {
		grid-area: title;
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
