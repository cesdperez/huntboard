<script lang="ts">
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import { resolve } from '$app/paths';
	import LinksSection from '#lib/components/setup/links-section.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<h1 class="type-title">Share</h1>

<div class="mt-6 flex flex-col gap-10">
	<div class="flex flex-col items-start gap-3">
		<p>
			Each team joins with its own link. Send it, or let them scan its QR code. No app or account
			needed.
		</p>
		{#if data.teams.length > 0}
			<Button href={resolve('/a/[token]/share/print', { token: data.game.admin_token })}>
				<PrinterIcon aria-hidden="true" />
				Print team QR codes
			</Button>
		{/if}
	</div>
	<LinksSection game={data.game} teams={data.teams} />
</div>
