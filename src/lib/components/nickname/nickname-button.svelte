<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { nickname } from './nickname-store.svelte.js';
</script>

{#if nickname.value}
	<!-- Shrinks, so a partner wordmark, How to play and a long name still fit a 390px phone. -->
	<Button
		bind:ref={nickname.button}
		variant="ghost"
		class="max-w-40 min-w-0 shrink truncate"
		onclick={() => (nickname.editing = true)}
	>
		<span class="sr-only">Change nickname. Current:</span>
		<span class="truncate">{nickname.value}</span>
	</Button>
{/if}
