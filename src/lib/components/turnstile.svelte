<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '#lib/components/ui/button/index.js';

	interface TurnstileApi {
		render(container: HTMLElement, options: Record<string, unknown>): string;
		reset(id: string): void;
		remove(id: string): void;
	}

	let { siteKey, token = $bindable('') }: { siteKey: string; token?: string } = $props();
	let container: HTMLDivElement;
	let widgetId: string | undefined;
	let script: HTMLScriptElement | undefined;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	let message = $state('Loading verification…');
	let failed = $state(false);
	let mounted = false;

	function api() {
		return (window as Window & { turnstile?: TurnstileApi }).turnstile;
	}

	function failure() {
		token = '';
		failed = true;
		message = 'Verification could not complete. Check your connection and try again.';
	}

	function render() {
		clearTimeout(timeout);
		if (!mounted) return;
		try {
			widgetId = api()!.render(container, {
				sitekey: siteKey,
				action: 'create-game',
				theme: 'light',
				size: 'flexible',
				'response-field': false,
				callback: (response: string) => {
					token = response;
					failed = false;
					message = '';
				},
				'expired-callback': () => {
					token = '';
				},
				'timeout-callback': failure,
				'error-callback': () => {
					failure();
					return true;
				}
			});
			message = '';
		} catch {
			failure();
		}
	}

	function initialize() {
		token = '';
		failed = false;
		message = 'Loading verification…';
		if (api()) {
			if (widgetId !== undefined) api()!.remove(widgetId);
			render();
			return;
		}
		script?.remove();
		script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.onload = render;
		script.onerror = () => {
			clearTimeout(timeout);
			failure();
		};
		timeout = setTimeout(() => {
			script?.remove();
			failure();
		}, 15_000);
		document.head.appendChild(script);
	}

	export function reset() {
		token = '';
		if (!mounted || widgetId === undefined) return;
		try {
			api()!.reset(widgetId);
			failed = false;
			message = '';
		} catch {
			failure();
		}
	}

	onMount(() => {
		mounted = true;
		initialize();
		return () => {
			mounted = false;
			clearTimeout(timeout);
			if (script) {
				script.onload = null;
				script.onerror = null;
				script.remove();
			}
			if (widgetId !== undefined) api()?.remove(widgetId);
		};
	});
</script>

<div class="flex flex-col gap-2">
	<div bind:this={container}></div>
	<input type="hidden" name="cf-turnstile-response" value={token} />
	{#if message}
		<p class="text-[15px] text-muted" role="status">{message}</p>
	{/if}
	{#if failed}
		<Button type="button" onclick={initialize}>Retry verification</Button>
	{/if}
</div>
