import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { AppClient } from './http.ts';
import { playHunt } from './hunt.ts';
import { report } from './report.ts';

const { values: options } = parseArgs({
	options: {
		speed: { type: 'string', default: '30' },
		seed: { type: 'string', default: '1' },
		port: { type: 'string', default: '4174' }
	}
});
const speed = Number(options.speed);
const baseUrl = `http://localhost:${options.port}`;
// Its own D1 state, so other local games cannot add rows to what the run measures.
const STATE_DIR = '.wrangler/loadtest';

function wrangler(args: string[]): string {
	return execFileSync('pnpm', ['exec', 'wrangler', ...args, '--persist-to', STATE_DIR], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'inherit']
	});
}

async function waitForServer(server: ReturnType<typeof spawn>) {
	for (let tries = 0; tries < 60; tries += 1) {
		if (server.exitCode !== null) throw new Error('wrangler dev exited before it served');
		try {
			await fetch(baseUrl, { redirect: 'manual' });
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}
	throw new Error(`Nothing served on ${baseUrl}`);
}

rmSync(STATE_DIR, { recursive: true, force: true });
wrangler(['d1', 'migrations', 'apply', 'huntboard', '--local']);
// /new needs the production creation code, so the game goes in directly.
const adminToken = randomBytes(16).toString('hex');
wrangler([
	'd1',
	'execute',
	'huntboard',
	'--local',
	'--command',
	`INSERT INTO game (name, admin_token, scoreboard_token)
	VALUES ('Load test hunt', '${adminToken}', '${randomBytes(16).toString('hex')}')`
]);

const server = spawn(
	'pnpm',
	[
		'exec',
		'wrangler',
		'dev',
		'.svelte-kit/cloudflare/_worker.js',
		'--port',
		options.port,
		'--persist-to',
		STATE_DIR,
		'--var',
		'LOADTEST_METRICS:1',
		// The custom domain route would hand the Worker http://<domain>, which it redirects to https.
		'--local-upstream',
		`localhost:${options.port}`
	],
	{ stdio: 'ignore', detached: true }
);
const stopServer = () => {
	if (server.pid && server.exitCode === null) process.kill(-server.pid);
};
process.on('exit', stopServer);
process.on('SIGINT', () => process.exit(130));

await waitForServer(server);
const minutes = ((5 * 60) / speed).toFixed(1);
console.log(`Playing a 5 hour hunt at ${speed}x: about ${minutes} minutes plus 2 for the rushes.`);
const client = new AppClient(baseUrl);
const result = await playHunt(client, adminToken, speed, Number(options.seed));
const failed = report(client.samples, result);
process.exit(failed.length > 0 ? 1 : 0);
