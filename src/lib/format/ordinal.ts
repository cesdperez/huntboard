const suffixes: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };
const rules = new Intl.PluralRules('en', { type: 'ordinal' });

/** "1st", "2nd", "11th", for ranks. */
export function ordinal(n: number): string {
	return `${n}${suffixes[rules.select(n)]}`;
}
