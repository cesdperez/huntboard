<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { resolve } from '$app/paths';
	import { AppBar, EventBanner } from '#lib/components/event/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Sheet from '#lib/components/ui/sheet/index.js';
	import { Marker, type MarkerState } from '#lib/components/marker/index.js';
	import { ClaimMediaView, MediaThumb, UploadStatus } from '#lib/components/media/index.js';
	import { Points } from '#lib/components/points/index.js';
	import ChallengeRow from '#lib/components/team/challenge-row.svelte';
	import SectionHeading from '#lib/components/team/section-heading.svelte';
	import TeamStrip from '#lib/components/team/team-strip.svelte';
	import type { Standing } from '#lib/domain/scoring.js';
	import type { TeamChallenge } from '#lib/domain/team-board.js';
	import {
		THEMES,
		resolveTheme,
		supportedModes,
		themeImages,
		type ColorMode
	} from '#lib/themes/index.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let sheetOpen = $state(false);

	const theme = $derived(resolveTheme(data.gameTheme));
	const modeOptions = $derived<(ColorMode | null)[]>(
		supportedModes(theme).length > 1 ? [null, 'light', 'dark'] : supportedModes(theme)
	);

	function preview(themeId: string, mode: ColorMode | null | undefined): string {
		const query = `theme=${encodeURIComponent(themeId)}${mode ? `&mode=${mode}` : ''}`;
		return `${resolve('/dev/design')}?${query}`;
	}

	const palette = [
		{ token: '--paper', use: 'Page background' },
		{ token: '--surface', use: 'Sheets, rows, inputs' },
		{ token: '--ink', use: 'Text, outlines, icons' },
		{ token: '--muted', use: 'Secondary text, open markers' },
		{ token: '--line', use: 'Dividers' },
		{ token: '--input-line', use: 'Input borders' },
		{ token: '--danger', use: 'Reject, penalties' },
		{ token: '--scrim', use: 'Overlay behind sheets' }
	];

	const roles = [
		{ token: '--marker', use: 'Pending and scored markers, the Queue badge' },
		{ token: '--on-marker', use: 'Points on a scored marker' },
		{ token: '--action', use: 'The primary button' },
		{ token: '--on-action', use: 'Label on the primary button' },
		{ token: '--own', use: "Bar on the team's own row" },
		{ token: '--own-row', use: "Background of the team's own row" },
		{ token: '--strip', use: 'Sticky team strip' },
		{ token: '--on-strip', use: 'Text on the strip' },
		{ token: '--on-strip-muted', use: 'Secondary text on the strip' },
		{ token: '--strip-line', use: 'Dividers on the strip' },
		{ token: '--strip-score', use: 'Total on the strip' },
		{ token: '--strip-own-row', use: "Background of the team's own row on the strip" },
		{ token: '--strip-danger', use: 'Errors on the strip' },
		{ token: '--score', use: 'Score totals' },
		{ token: '--section', use: 'Band behind team page section headings' },
		{ token: '--on-section', use: 'Section heading text' },
		{ token: '--waiting', use: 'Waiting for a judge' },
		{ token: '--app-bar', use: 'Event layout app bar' },
		{ token: '--on-app-bar', use: 'Text on the app bar' },
		{ token: '--banner', use: 'Event banner' },
		{ token: '--on-banner', use: 'Text on the event banner' },
		{ token: '--section-rule', use: 'Rule beside event layout section headings' }
	];

	const sampleImage = { src: themeImages(THEMES[0]).share, label: 'Birthday invitation' };

	const sampleStandings: Standing[] = [
		{
			teamId: 1,
			rank: 1,
			name: 'Night Owls',
			members: 'Cas, Dee',
			avatarKey: null,
			total: 180,
			own: false
		},
		{
			teamId: 2,
			rank: 2,
			name: 'Canal Rats',
			members: 'Ana, Bo',
			avatarKey: null,
			total: 145,
			own: true
		}
	];

	const sampleChallenges: TeamChallenge[] = [
		{
			id: 3,
			title: 'Make a birthday card',
			description: 'Get creative, any material counts.',
			section: 'Around town',
			minPoints: 5,
			maxPoints: 20,
			claim: null
		},
		{
			id: 1,
			title: 'Free Marktplaats item',
			description: 'Find something given away for free and bring it to the meeting point.',
			section: 'Around town',
			minPoints: 30,
			maxPoints: 100,
			claim: {
				id: 1,
				status: 'pending',
				note: null,
				markedBy: 'Ana',
				markedAt: '2026-10-23T11:50:00.000Z',
				points: null,
				judgedBy: null,
				judgeNote: null,
				media: null
			}
		},
		{
			id: 4,
			title: 'Swim in a fountain',
			description: 'Get a team member in a public fountain.',
			section: 'Around town',
			minPoints: 25,
			maxPoints: 25,
			claim: {
				id: 4,
				status: 'scored',
				note: null,
				markedBy: 'Ana',
				markedAt: '2026-10-23T11:10:00.000Z',
				points: 25,
				judgedBy: 'Sam',
				judgeNote: null,
				media: null
			}
		},
		{
			id: 2,
			title: 'Free dessert',
			description: 'Get a free dessert somewhere in town.',
			section: 'Around town',
			minPoints: 10,
			maxPoints: 15,
			claim: {
				id: 2,
				status: 'rejected',
				note: null,
				markedBy: 'Bo',
				markedAt: '2026-10-23T11:20:00.000Z',
				points: null,
				judgedBy: 'Sam',
				judgeNote: 'No proof received',
				media: null
			}
		}
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
		{ role: 'Score totals, in --font-score', className: 'type-score', sample: '145' },
		{ role: 'Ranks, in --font-display', className: 'type-rank', sample: '1st' },
		{
			role: 'Event banner title, in --font-banner',
			className: 'font-banner text-[44px] leading-none uppercase',
			sample: 'Birthday hunt'
		},
		{ role: 'Screen title, in --font-display', className: 'type-title', sample: 'Canal Rats' },
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
		<nav class="flex flex-wrap gap-2" aria-label="Theme">
			{#each THEMES as option (option.id)}
				<Button
					href={preview(option.id, data.colorMode)}
					variant={theme.id === option.id ? 'primary' : 'secondary'}
					aria-current={theme.id === option.id ? 'page' : undefined}
					class="flex-1"
				>
					{option.name}
				</Button>
			{/each}
		</nav>
		<nav class="flex gap-2" aria-label="Mode">
			{#each modeOptions as mode (mode)}
				{@const current = (data.colorMode ?? null) === mode || modeOptions.length === 1}
				<Button
					href={preview(theme.id, mode)}
					variant={current ? 'primary' : 'secondary'}
					aria-current={current ? 'page' : undefined}
					class="flex-1 capitalize"
				>
					{mode ?? 'system'}
				</Button>
			{/each}
		</nav>
	</header>

	{#snippet swatches(tokens: { token: string; use: string }[])}
		<ul class="flex flex-col">
			{#each tokens as color (color.token)}
				<li class="flex min-h-row items-center gap-3 border-b">
					<span
						class="size-marker-lg shrink-0 rounded-control border"
						style:background="var({color.token})"
					></span>
					<span class="flex min-w-0 flex-col">
						<code class="text-[15px] font-semibold">{color.token}</code>
						<span class="type-secondary">{color.use}</span>
					</span>
				</li>
			{/each}
		</ul>
	{/snippet}

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Colour</h2>
		{@render swatches(palette)}
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Roles</h2>
		{@render swatches(roles)}
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Team page</h2>
		{#if theme.layout === 'event'}
			<div class="-mx-gutter flex flex-col gap-4">
				<div>
					<AppBar><Button variant="ghost">Ana</Button></AppBar>
					<EventBanner
						name="Birthday hunt"
						day="12 June"
						countdown="Ends in 1:42:10"
						image={sampleImage}
					/>
				</div>
				<EventBanner
					name="Birthday hunt"
					day="12 June"
					countdown="Starts in 0:42:10"
					image={null}
				/>
			</div>
		{/if}
		<div class="-mx-gutter">
			<TeamStrip
				teamName="Canal Rats"
				members="Ana, Bo"
				standings={sampleStandings}
				countdown="Ends in 1:42:10"
				onrename={() => {}}
			/>
		</div>
		<div class="flex flex-col">
			<SectionHeading section="Around town" />
			<ul class={['flex flex-col', theme.layout === 'plain' && 'border-t']}>
				{#each sampleChallenges as challenge (challenge.id)}
					<ChallengeRow {challenge} onselect={() => {}} />
				{/each}
			</ul>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="type-heading">Claim media</h2>
		<div class="flex flex-col gap-4">
			<UploadStatus
				phase="preparing"
				kind="video"
				progress={null}
				preview={null}
				error={null}
				onremove={() => {}}
			/>
			<UploadStatus
				phase="preparing"
				kind="video"
				progress={0.4}
				preview={null}
				error={null}
				onremove={() => {}}
			/>
			<UploadStatus
				phase="uploading"
				kind="photo"
				progress={0.7}
				preview={sampleImage.src}
				error={null}
				onremove={() => {}}
			/>
			<UploadStatus
				phase="ready"
				kind="photo"
				progress={null}
				preview={sampleImage.src}
				error={null}
				onremove={() => {}}
			/>
			<UploadStatus
				phase="failed"
				kind="video"
				progress={null}
				preview={null}
				error="This video is longer than 60 seconds. Trim it and try again."
				onremove={() => {}}
			/>
		</div>
		<div class="flex items-center gap-3">
			<MediaThumb kind="photo" src={sampleImage.src} class="size-8" />
			<MediaThumb kind="video" class="size-8" />
			<MediaThumb kind="photo" src={sampleImage.src} class="size-10" />
			<MediaThumb kind="video" class="size-10" />
			<span class="type-secondary">Thumbnails on a team row and in its sheet</span>
		</div>
		<ClaimMediaView
			media={{ src: sampleImage.src, kind: 'photo' }}
			label="Canal Rats, Swim"
			preload="none"
		/>
		<p class="type-secondary">Judges see a video in the same box, with the browser's controls.</p>
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
						class="w-full rounded-control border-2 border-input-line bg-surface p-3 text-ink"
						placeholder="Photo sent at 17:02"></textarea>
				</label>
				<Sheet.Footer>
					<Button variant="primary" size="lg" onclick={() => (sheetOpen = false)}>Mark done</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>
	</section>
</main>
