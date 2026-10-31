<script lang="ts">
	import { onMount } from 'svelte';
	import { NICKNAME_MAX_LENGTH } from '#lib/domain/nickname.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { nickname } from './nickname-store.svelte.js';

	/** editOnly leaves the first ask to the page, which then opens this only from the nickname button. */
	let { editOnly = false }: { editOnly?: boolean } = $props();

	let draft = $state('');
	let invalid = $state(false);
	// Without a nickname there is nothing to attribute actions to, so the first prompt cannot be dismissed.
	const dismissable = $derived(editOnly || nickname.value !== null);
	const open = $derived(editOnly ? nickname.loaded && nickname.editing : nickname.promptOpen);

	onMount(() => nickname.load());

	function onOpenChange(isOpen: boolean) {
		if (!isOpen) nickname.editing = false;
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		invalid = !nickname.save(draft);
	}

	$effect(() => {
		if (open) {
			draft = nickname.value ?? '';
			invalid = false;
		}
	});
</script>

<Sheet.Root {open} {onOpenChange}>
	<Sheet.Content
		showCloseButton={dismissable}
		interactOutsideBehavior={dismissable ? 'close' : 'ignore'}
		escapeKeydownBehavior={dismissable ? 'close' : 'ignore'}
		onCloseAutoFocus={(event) => {
			// The page opens the first prompt, and Safari never focuses a tapped button, so the
			// default would often leave focus on the page body.
			if (!nickname.button) return;
			event.preventDefault();
			nickname.button.focus();
		}}
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
					<p id="nickname-error" class="text-[15px] text-danger" role="alert">
						Type a nickname to continue.
					</p>
				{/if}
			</div>
			<Button type="submit" variant="primary" size="lg">Save nickname</Button>
		</form>
	</Sheet.Content>
</Sheet.Root>
