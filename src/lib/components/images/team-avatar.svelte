<script lang="ts">
	import { imageSrc, initialOf } from '#lib/domain/images.js';
	import { cn } from '#lib/utils.js';

	type Props = {
		name: string;
		avatarKey: string | null;
		/** Sets the size, like size-8. The initial scales with the font size. */
		class?: string;
	};

	let { name, avatarKey, class: className }: Props = $props();
</script>

<!-- Decorative: the team name always sits beside it. -->
{#if avatarKey}
	<img
		src={imageSrc(avatarKey)}
		alt=""
		width="256"
		height="256"
		decoding="async"
		class={cn('shrink-0 rounded-full border object-cover', className)}
	/>
{:else}
	<span
		aria-hidden="true"
		class={cn(
			'flex shrink-0 items-center justify-center rounded-full border bg-paper leading-none font-semibold text-muted',
			className
		)}
	>
		{initialOf(name)}
	</span>
{/if}
