<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import { Button } from '#lib/components/ui/button/index.js';
	import type { GameClock } from '#lib/client/game-clock.svelte.js';
	import { AVATAR_SPEC, resizeImage } from '#lib/client/image-resize.js';
	import { TeamAction } from './team-action.svelte.js';

	type Props = { hasAvatar: boolean; clock: GameClock };

	let { hasAvatar, clock }: Props = $props();

	const action = new TeamAction(() => clock);
	let form = $state<HTMLFormElement | null>(null);
	let input = $state<HTMLInputElement | null>(null);

	function picked() {
		if (!input?.files?.length) return;
		form?.requestSubmit();
		// The form data is already taken, and an empty input lets the same file be picked again.
		input.value = '';
	}

	const upload: SubmitFunction = async (submission) => {
		const file = submission.formData.get('avatar');
		if (!(file instanceof File) || file.size === 0) return submission.cancel();

		action.clearError();
		action.busy = true;
		const resized = await resizeImage(file, AVATAR_SPEC);
		if (!resized.ok) {
			action.busy = false;
			action.fail(resized.message);
			return submission.cancel();
		}
		submission.formData.set('avatar', resized.image);
		return action.submit('Picture saved', () => {})(submission);
	};
</script>

<form
	bind:this={form}
	method="POST"
	action="?/avatar"
	enctype="multipart/form-data"
	class="flex flex-1"
	use:enhance={upload}
>
	<input
		bind:this={input}
		type="file"
		name="avatar"
		accept="image/*"
		class="hidden"
		aria-hidden="true"
		tabindex="-1"
		onchange={picked}
	/>
	<Button class="flex-1" disabled={action.busy} onclick={() => input?.click()}>
		{#if action.busy}
			Saving picture
		{:else}
			{hasAvatar ? 'Change picture' : 'Add picture'}
		{/if}
	</Button>
</form>
{#if action.error}
	<p class="basis-full text-[15px] text-danger" role="alert">{action.error}</p>
{/if}
