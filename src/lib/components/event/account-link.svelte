<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	type Props = {
		/** Shows "Sign in" to a signed-out visitor. Pages players land on leave it off. */
		offerSignIn?: boolean;
	};

	let { offerSignIn = false }: Props = $props();

	const signedIn = $derived(page.data.signedIn ?? false);
</script>

{#if signedIn || offerSignIn}
	<a
		href={resolve('/games')}
		class="inline-flex min-h-touch items-center text-[17px] font-semibold underline-offset-4 hover:underline"
		>{signedIn ? 'My games' : 'Sign in'}</a
	>
{/if}
