<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { DISPLAY_NAME_MAX_LENGTH } from '#lib/domain/account.js';

	let { error = null }: { error?: string | null } = $props();
</script>

<div class="flex flex-col gap-2">
	<Label for="display-name">Your name</Label>
	<Input
		id="display-name"
		name="displayName"
		required
		autocomplete="name"
		maxlength={DISPLAY_NAME_MAX_LENGTH}
		aria-invalid={error ? true : undefined}
		aria-describedby="display-name-hint"
	/>
	<p id="display-name-hint" class="type-secondary">
		This email is new here, so this creates your account. Players do not see your name.
	</p>
</div>
