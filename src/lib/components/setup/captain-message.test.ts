import { describe, expect, it } from 'vitest';
import { captainMessage, whatsAppLink } from './captain-message.js';

const team = {
	gameName: 'Birthday hunt',
	teamName: 'Canal Rats',
	teamLink: 'https://huntboard.example.com/t/abc123',
	joinPage: 'huntboard.example.com/join',
	joinCode: 'K7Q4-M2XD',
	startsAt: null
};
const NOW = new Date('2026-06-01T12:00:00.000Z');
const amsterdam = { locale: 'en-GB', timeZone: 'Europe/Amsterdam' };

describe('captainMessage', () => {
	it('tells the captain how to get the team in, with the link and the join code', () => {
		expect(captainMessage(team, NOW, amsterdam)).toBe(
			[
				'Hi! You are the captain of *Canal Rats* in *Birthday hunt*.',
				'',
				'1. Make a WhatsApp group with your team and add me, so we can sort out questions during the game.',
				'',
				'2. Share this link in the group. Everyone opens it to join the team:',
				'https://huntboard.example.com/t/abc123',
				'Or go to huntboard.example.com/join and type the code *K7Q4-M2XD*.',
				'Standing together? Open the link and tap "Show QR", so teammates can scan it from your screen.'
			].join('\n')
		);
	});

	it('ends with the start day and time in the admin time zone', () => {
		const message = captainMessage(
			{ ...team, startsAt: '2026-06-06T12:30:00.000Z' },
			NOW,
			amsterdam
		);
		expect(message.split('\n').slice(-2)).toEqual(['', 'The game starts on 6 June at 14:30.']);
	});

	it('uses the day as the admin sees it, not as UTC sees it', () => {
		const message = captainMessage(
			{ ...team, startsAt: '2026-06-06T22:30:00.000Z' },
			NOW,
			amsterdam
		);
		expect(message).toMatch(/The game starts on 7 June at 00:30\.$/);
	});
});

describe('whatsAppLink', () => {
	it('opens WhatsApp with the text and no number, so the sender picks the chat', () => {
		expect(whatsAppLink('Hi! *Canal Rats* & co\n1. Go')).toBe(
			'https://wa.me/?text=Hi!%20*Canal%20Rats*%20%26%20co%0A1.%20Go'
		);
	});
});
