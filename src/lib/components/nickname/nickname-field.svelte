<script lang="ts">
	import { nickname } from './nickname-store.svelte.js';
</script>

<!-- Server actions read this through readNickname() from #lib/server/form.js. -->
<input type="hidden" name="nickname" value={nickname.value ?? ''} />
