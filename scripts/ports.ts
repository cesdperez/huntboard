// Ports for this checkout, so several worktrees can run dev, preview and E2E at once.
// Usage: node scripts/ports.ts [--all | --urls | dev | loadtest]
import { createHash } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Checkout {
	path: string;
	isMain: boolean;
}

const MAIN_PREVIEW_PORT = 4173;
const MAIN_LOADTEST_PORT = 4174;
const MAIN_DEV_PORT = 5173;
// Each worktree takes three consecutive ports.
const WORKTREE_FIRST_PORT = 41000;
const WORKTREE_SLOTS = 2600;

export function previewPortFor(checkout: Checkout, override?: string): number {
	if (override) return parsePort(override);
	if (checkout.isMain) return MAIN_PREVIEW_PORT;
	return WORKTREE_FIRST_PORT + 3 * pathHash(checkout.path);
}

export function loadtestPortFor(checkout: Checkout, override?: string): number {
	if (!override && checkout.isMain) return MAIN_LOADTEST_PORT;
	return previewPortFor(checkout, override) + 1;
}

export function devPortFor(checkout: Checkout, override?: string): number {
	if (!override && checkout.isMain) return MAIN_DEV_PORT;
	return previewPortFor(checkout, override) + 2;
}

export function checkoutAt(root: string): Checkout {
	const git = statSync(join(root, '.git'), { throwIfNoEntry: false });
	// A linked worktree has a .git file; the main checkout has the .git directory.
	return { path: realpathSync(root), isMain: git?.isDirectory() ?? true };
}

function parsePort(value: string): number {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 1 || port > 65533) {
		throw new Error(`HUNTBOARD_PORT must be a port from 1 to 65533, got "${value}"`);
	}
	return port;
}

function pathHash(path: string): number {
	return Number(
		BigInt(`0x${createHash('sha256').update(path).digest('hex')}`) % BigInt(WORKTREE_SLOTS)
	);
}

const checkout = checkoutAt(fileURLToPath(new URL('..', import.meta.url)));
export const PREVIEW_PORT = previewPortFor(checkout, process.env.HUNTBOARD_PORT);
export const LOADTEST_PORT = loadtestPortFor(checkout, process.env.HUNTBOARD_PORT);
export const DEV_PORT = devPortFor(checkout, process.env.HUNTBOARD_PORT);

if (import.meta.main) {
	const mode = process.argv[2];
	if (mode === '--all') console.log(`${PREVIEW_PORT}\n${LOADTEST_PORT}\n${DEV_PORT}`);
	else if (mode === '--urls')
		console.log(
			`preview  http://localhost:${PREVIEW_PORT}\nloadtest http://localhost:${LOADTEST_PORT}\ndev      http://localhost:${DEV_PORT}`
		);
	else if (mode === 'dev') console.log(String(DEV_PORT));
	else if (mode === 'loadtest') console.log(String(LOADTEST_PORT));
	// A bare number gets ANSI colours under FORCE_COLOR, which Playwright sets for its web server.
	else console.log(String(PREVIEW_PORT));
}
