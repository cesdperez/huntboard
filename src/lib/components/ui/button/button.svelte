<script lang="ts" module>
	import { type VariantProps, tv } from 'tailwind-variants';
	import { cn, type WithElementRef } from '#lib/utils.js';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	/** One `primary` per screen or sheet. `destructive` actions must confirm before acting. */
	export const buttonVariants = tv({
		base: 'inline-flex shrink-0 items-center justify-center gap-2 rounded-control border-2 border-transparent text-[17px] leading-tight font-semibold whitespace-nowrap transition-colors duration-150 select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-5',
		variants: {
			variant: {
				primary: 'bg-action text-on-action hover:bg-action-hover',
				secondary: 'border-ink bg-transparent text-ink hover:bg-ink/5',
				destructive: 'border-danger bg-transparent text-danger hover:bg-danger/5',
				ghost: 'bg-transparent text-ink hover:bg-ink/5'
			},
			size: {
				default: 'min-h-touch px-4',
				lg: 'min-h-row px-5',
				icon: 'size-touch'
			}
		},
		defaultVariants: {
			variant: 'secondary',
			size: 'default'
		}
	});

	export type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];
	export type ButtonSize = VariantProps<typeof buttonVariants>['size'];

	export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
		WithElementRef<HTMLAnchorAttributes> & {
			variant?: ButtonVariant;
			size?: ButtonSize;
			/** Refuses activation while a request runs but keeps focus, which `disabled` drops to the page. */
			busy?: boolean;
		};
</script>

<script lang="ts">
	let {
		class: className,
		variant = 'secondary',
		size = 'default',
		ref = $bindable(null),
		href = undefined,
		type = 'button',
		disabled,
		busy = false,
		onclick,
		children,
		...restProps
	}: ButtonProps = $props();

	// Enter in a field submits through a click on the form's button, so this also stops that.
	function guardedClick(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		if (busy) {
			event.preventDefault();
			return;
		}
		onclick?.(event);
	}
</script>

{#if href}
	<!-- Callers pass an href already built with resolve(). -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		href={disabled ? undefined : href}
		aria-disabled={disabled}
		role={disabled ? 'link' : undefined}
		tabindex={disabled ? -1 : undefined}
		{onclick}
		{...restProps}
	>
		{@render children?.()}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button
		bind:this={ref}
		data-slot="button"
		class={cn(buttonVariants({ variant, size }), className)}
		{type}
		{disabled}
		aria-disabled={busy || undefined}
		onclick={guardedClick}
		{...restProps}
	>
		{@render children?.()}
	</button>
{/if}
