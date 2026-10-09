<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Marker, type MarkerState } from '#lib/components/marker/index.js';
	import { Points } from '#lib/components/points/index.js';

	type Theme = 'system' | 'light' | 'dark';

	let theme = $state<Theme>('system');
	let sheetOpen = $state(false);

	$effect(() => {
		const root = document.documentElement;
		if (theme === 'system') delete root.dataset.theme;
		else root.dataset.theme = theme;
		return () => delete root.dataset.theme;
	});

	const colors = [
		{ token: '--paper', use: 'Page background' },
		{ token: '--surface', use: 'Sheets, rows, inputs' },
		{ token: '--ink', use: 'Text, outlines, icons' },
		{ token: '--muted', use: 'Secondary text, open markers' },
		{ token: '--line', use: 'Dividers, input borders' },
		{ token: '--flag', use: 'Markers, primary action' },
		{ token: '--on-flag', use: 'Text on flag orange' },
		{ token: '--danger', use: 'Reject, penalties' }
	];

	const radii = [
		{ name: 'Marker', className: 'rounded-marker', value: '3px' },
		{ name: 'Control', className: 'rounded-control', value: '10px' },
		{ name: 'Sheet', className: 'rounded-t-sheet', value: '16px top' }
	];

	const spacing = [
		{ name: 'Gutter', className: 'w-gutter', value: '16px' },
		{ name: 'Marker', className: 'w-marker', value: '28px' },
		{ name: 'Marker, grid', className: 'w-marker-lg', value: '40px' },
		{ name: 'Touch target', className: 'w-touch', value: '48px' },
		{ name: 'Row', className: 'w-row', value: '56px' }
	];

	const typeScale = [
		{ role: 'Score totals, ranks', className: 'type-score', sample: '1st 145' },
		{ role: 'Screen title', className: 'type-title', sample: 'Canal Rats' },
		{ role: 'Section heading', className: 'type-heading', sample: 'Around town' },
		{ role: 'Body, challenge titles', className: 'type-body', sample: 'Swim in a fountain' },
		{ role: 'Secondary text', className: 'type-secondary', sample: 'Rejected: no proof received' },
		{ role: 'Point ranges', className: 'type-range', sample: '30–100' }
	];

	const markers: { state: MarkerState; points?: number }[] = [
		{ state: 'open' },
		{ state: 'pending' },
		{ state: 'scored', points: 15 },
		{ state: 'rejected' }
	];

	const rows: { title: string; state: MarkerState; points?: number; min: number; max: number }[] = [
		{ title: 'Make a birthday card', state: 'open', min: 5, max: 20 },
		{ title: 'Free Marktplaats item', state: 'pending', min: 30, max: 100 },
		{ title: 'Swim in a fountain', state: 'scored', points: 25, min: 25, max: 25 },
		{ title: 'Free dessert', state: 'rejected', min: 10, max: 15 },
		{ title: 'Ride every ferry', state: 'scored', points: 100, min: 50, max: 100 }
	];
</script>

<svelte:head>
	<title>Design system</title>
</svelte:head>

<main class="mx-auto flex max-w-content flex-col gap-10 px-gutter pt-6 pb-16">
	<header class="flex flex-col gap-4">
		<h1 class="type-title">Design system</h1>
		<div class="flex gap-2" role="group" aria-label="Theme">
			{#each ['system', 'light', 'dark'] as const as option (option)}
				<Button
					variant={theme === option ? 'primary' : 'secondary'}
					aria-pressed={theme === option}
					class="flex-1 capitalize"
					onclick={() => (theme = option)}
				>
					{option}
				</Button>
			{/each}
		</div>
	</header>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Colour</h2>
		<ul class="flex flex-col">
			{#each colors as color (color.token)}
				<li class="flex min-h-row items-center gap-3 border-b">
					<span
						class="size-marker-lg shrink-0 rounded-control border"
						style:background-color="var({color.token})"
					></span>
					<span class="flex min-w-0 flex-col">
						<code class="text-[15px] font-semibold">{color.token}</code>
						<span class="type-secondary">{color.use}</span>
					</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Radii</h2>
		<div class="flex gap-4">
			{#each radii as radius (radius.name)}
				<div class="flex flex-col items-start gap-1">
					<span class="block size-16 border-2 border-ink bg-surface {radius.className}"></span>
					<span class="type-secondary">{radius.name}, {radius.value}</span>
				</div>
			{/each}
		</div>
		<p class="type-secondary">List rows have no radius. They are divided by lines.</p>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Spacing</h2>
		<ul class="flex flex-col gap-2">
			{#each spacing as space (space.name)}
				<li class="flex items-center gap-3">
					<span class="block h-4 shrink-0 bg-ink {space.className}"></span>
					<span class="type-secondary">{space.name}, {space.value}</span>
				</li>
			{/each}
		</ul>
		<p class="type-secondary">Content column is capped at 640px.</p>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Type</h2>
		<ul class="flex flex-col gap-4">
			{#each typeScale as type (type.role)}
				<li class="flex flex-col gap-1">
					<span class={type.className}>{type.sample}</span>
					<span class="type-secondary">{type.role}</span>
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Markers</h2>
		{#each ['list', 'grid'] as const as size (size)}
			<div class="flex flex-wrap gap-4">
				{#each markers as marker (marker.state)}
					<div class="flex w-16 flex-col items-center gap-1">
						<Marker state={marker.state} points={marker.points} {size} />
						<span class="type-secondary capitalize">{marker.state}</span>
					</div>
				{/each}
			</div>
		{/each}
		<p class="type-secondary">In grayscale, state still reads from shape:</p>
		<div class="flex flex-wrap gap-4 grayscale">
			{#each markers as marker (marker.state)}
				<Marker state={marker.state} points={marker.points} size="grid" />
			{/each}
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Points</h2>
		<div class="flex flex-wrap items-baseline gap-6">
			<Points min={5} max={20} />
			<Points value={25} />
			<Points value={-12} />
			<Points value={145} variant="total" />
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Rows</h2>
		<ul class="flex flex-col border-t bg-surface">
			{#each rows as row (row.title)}
				<li class="flex min-h-row items-center gap-3 border-b px-gutter">
					<Marker state={row.state} points={row.points} />
					<span class="min-w-0 flex-1 truncate">{row.title}</span>
					<Points min={row.min} max={row.max} />
				</li>
			{/each}
		</ul>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Buttons</h2>
		<div class="flex flex-col gap-3">
			<Button variant="primary">Mark done</Button>
			<Button>Undo claim</Button>
			<Button variant="destructive">Reject</Button>
			<Button variant="ghost">Cancel</Button>
			<Button variant="primary" disabled>Disabled</Button>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			{#each [5, 12, 20] as quick (quick)}
				<Button size="lg" class="min-w-row tabular">{quick}</Button>
			{/each}
			<Button size="icon" variant="ghost" aria-label="Close">
				<XIcon />
			</Button>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Sheet</h2>
		<Sheet.Root bind:open={sheetOpen}>
			<Sheet.Trigger>
				{#snippet child({ props })}
					<Button {...props}>Open bottom sheet</Button>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content>
				<Sheet.Header>
					<Sheet.Title>Swim in a fountain</Sheet.Title>
					<Sheet.Description>
						Any public fountain counts. Send a photo to the organiser.
					</Sheet.Description>
				</Sheet.Header>
				<label class="flex flex-col gap-1">
					<span class="type-secondary">Note for the judge</span>
					<textarea
						rows="3"
						class="w-full rounded-control border-2 border-line bg-surface p-3 text-ink"
						placeholder="Photo sent at 17:02"></textarea>
				</label>
				<Sheet.Footer>
					<Button variant="primary" size="lg" onclick={() => (sheetOpen = false)}>Mark done</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>
	</section>
</main>
