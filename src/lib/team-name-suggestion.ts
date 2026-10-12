export const TEAM_NAME_ADJECTIVES = [
	'Bold',
	'Brave',
	'Bright',
	'Cheeky',
	'Clever',
	'Cosmic',
	'Crafty',
	'Daring',
	'Dizzy',
	'Electric',
	'Fearless',
	'Fierce',
	'Flying',
	'Funky',
	'Galloping',
	'Giddy',
	'Golden',
	'Grumpy',
	'Happy',
	'Hungry',
	'Jolly',
	'Lucky',
	'Mighty',
	'Nimble',
	'Noisy',
	'Plucky',
	'Quick',
	'Rapid',
	'Restless',
	'Rowdy',
	'Sneaky',
	'Speedy',
	'Sleepy',
	'Sparkly',
	'Swift',
	'Thunder',
	'Turbo',
	'Wild',
	'Wobbly',
	'Zesty'
] as const;

export const TEAM_NAME_NOUNS = [
	'Badgers',
	'Bats',
	'Beavers',
	'Bees',
	'Bison',
	'Camels',
	'Cobras',
	'Crows',
	'Dolphins',
	'Ducks',
	'Eagles',
	'Falcons',
	'Ferrets',
	'Flamingos',
	'Foxes',
	'Frogs',
	'Geckos',
	'Goats',
	'Herons',
	'Hedgehogs',
	'Jackals',
	'Koalas',
	'Lemurs',
	'Llamas',
	'Lobsters',
	'Moose',
	'Narwhals',
	'Otters',
	'Owls',
	'Pandas',
	'Penguins',
	'Puffins',
	'Raccoons',
	'Rats',
	'Ravens',
	'Seals',
	'Sharks',
	'Squirrels',
	'Tigers',
	'Walruses',
	'Wolves',
	'Yaks'
] as const;

const MAX_ATTEMPTS = 20;

const pick = <T>(words: readonly T[], random: () => number) =>
	words[Math.floor(random() * words.length)];

/** A random two-word team name, avoiding the names in `taken` when it can. */
export function suggestTeamName(taken: string[], random: () => number = Math.random): string {
	const takenKeys = new Set(taken.map((name) => name.toLowerCase()));
	let name = '';
	for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
		name = `${pick(TEAM_NAME_ADJECTIVES, random)} ${pick(TEAM_NAME_NOUNS, random)}`;
		if (!takenKeys.has(name.toLowerCase())) return name;
	}
	return name;
}
