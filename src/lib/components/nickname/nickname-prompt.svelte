<script lang="ts">
	import { onMount } from 'svelte';
	import { NICKNAME_MAX_LENGTH } from '#lib/nickname.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { nickname } from './nickname-store.svelte.js';

	let draft = $state('');
	let invalid = $state(false);
	// Without a nickname there is nothing to attribute actions to, so the first prompt cannot be dismissed.
	const dismissable = $derived(nickname.value !== null);

	onMount(() => nickname.load());

	function onOpenChange(open: boolean) {
		if (!open) nickname.editing = false;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		invalid = !nickname.save(draft);
	}

	$effect(() => {
		if (nickname.promptOpen) {
			draft = nickname.value ?? '';
			invalid = false;
		}
	});
</script>

<Sheet.Root open={nickname.promptOpen} {onOpenChange}>
	<Sheet.Content
		showCloseButton={dismissable}
		interactOutsideBehavior={dismissable ? 'close' : 'ignore'}
		escapeKeydownBehavior={dismissable ? 'close' : 'ignore'}
	>
		<Sheet.Header>
			<Sheet.Title>What should we call you?</Sheet.Title>
			<Sheet.Description>
				Your nickname shows who marked or judged something. It stays in this browser.
			</Sheet.Description>
		</Sheet.Header>
		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-col gap-2">
				<Label for="nickname">Nickname</Label>
				<Input
					id="nickname"
					bind:value={draft}
					required
					maxlength={NICKNAME_MAX_LENGTH}
					autocomplete="nickname"
					aria-invalid={invalid || undefined}
					aria-describedby={invalid ? 'nickname-error' : undefined}
				/>
				{#if invalid}
					<p id="nickname-error" class="text-[15px] text-danger">Type a nickname to continue.</p>
				{/if}
			</div>
			<Button type="submit" variant="primary" size="lg">Save nickname</Button>
		</form>
	</Sheet.Content>
</Sheet.Root>
