<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { nickname } from './nickname-store.svelte.js';
</script>

{#if nickname.value}
	<Button variant="ghost" class="max-w-40 truncate" onclick={() => (nickname.editing = true)}>
		<span class="sr-only">Change nickname. Current:</span>
		<span class="truncate">{nickname.value}</span>
	</Button>
{/if}
