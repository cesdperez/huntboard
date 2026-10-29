<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { AdminAction } from '#lib/components/admin/admin-action.svelte.js';
	import { toast } from '#lib/components/toast/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { signInPath } from '#lib/domain/account.js';

	let { claim }: { claim: 'claim' | 'sign-in' } = $props();

	const action = new AdminAction('claim');
	const signInHref = $derived(signInPath(page.url.pathname));
</script>

<section aria-labelledby="claim-heading" class="flex flex-col gap-3">
	<h2 id="claim-heading" class="font-display type-heading">My games</h2>
	<p class="type-secondary">
		This game was made before accounts. Add it to your games to find it again without this link.
		Other admins keep using the link.
	</p>
	{#if action.error}
		<p class="text-[15px] text-danger" role="alert">{action.error}</p>
	{/if}
	{#if claim === 'claim'}
		<form
			method="POST"
			action="?/claimGame"
			use:enhance={action.submit(() => toast.show('Added to My games'))}
		>
			<Button type="submit" class="w-full" disabled={action.busy}>Add to My games</Button>
		</form>
	{:else}
		<!-- The sign-in page sends people back here only when next is a path on this site. -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<Button href={signInHref} class="w-full">Sign in to add it to your games</Button>
	{/if}
</section>
