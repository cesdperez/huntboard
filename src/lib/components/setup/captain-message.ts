import { formatDay, formatTime, type ClockTimeOptions } from '#lib/format/clock-time.js';

export interface CaptainMessageTeam {
	gameName: string;
	teamName: string;
	teamLink: string;
	joinPage: string;
	joinCode: string;
	startsAt: string | null;
}

/**
 * What the organiser sends a team captain to get the team into its own group chat.
 * Asterisks are bold in WhatsApp and read fine as plain text elsewhere.
 */
export function captainMessage(
	team: CaptainMessageTeam,
	now: Date,
	options: ClockTimeOptions = {}
): string {
	const lines = [
		`Hi! You are the captain of *${team.teamName}* in *${team.gameName}*.`,
		'',
		'1. Make a WhatsApp group with your team and add me, so we can sort out questions during the game.',
		'',
		'2. Share this link in the group. Everyone opens it to join the team:',
		team.teamLink,
		`Or go to ${team.joinPage} and type the code *${team.joinCode}*.`,
		'Standing together? Open the link and tap "Show QR", so teammates can scan it from your screen.'
	];
	if (team.startsAt)
		lines.push('', `The game starts on ${startTime(team.startsAt, now, options)}.`);
	return lines.join('\n');
}

// Always with the day, because the captain may read it days before the game.
function startTime(iso: string, now: Date, options: ClockTimeOptions): string {
	return `${formatDay(iso, now, options)} at ${formatTime(iso, options)}`;
}

/** A wa.me link without a number, so WhatsApp asks which chat to send the text to. */
export function whatsAppLink(message: string): string {
	return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
