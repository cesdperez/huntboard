import { parse, unflatten } from 'devalue';

/** One request the simulator sent, with the D1 usage the server reported for it. */
export interface Sample {
	phase: string;
	kind: string;
	startedAt: number;
	ms: number;
	status: number;
	calls: number;
	queries: number;
	rowsRead: number;
	rowsWritten: number;
	/** Set when the server sent no Server-Timing header, so its rows are unknown. */
	unmeasured: boolean;
}

export interface ActionResult<T> {
	status: number;
	data: T;
}

const REQUEST_TIMEOUT_MS = 30_000;
const NO_RESPONSE = {
	status: 0,
	calls: 0,
	queries: 0,
	rowsRead: 0,
	rowsWritten: 0,
	unmeasured: true
};
const USAGE = /calls=(\d+) queries=(\d+) rows_read=(\d+) rows_written=(\d+)/;

/** Talks to the app the way the SvelteKit client does: page loads, __data.json and form actions. */
export class AppClient {
	readonly samples: Sample[] = [];
	readonly baseUrl: string;
	#phase = 'setup';

	get phase(): string {
		return this.#phase;
	}

	set phase(phase: string) {
		console.log(`${new Date().toISOString().slice(11, 19)} ${phase}`);
		this.#phase = phase;
	}

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async page(kind: string, path: string): Promise<void> {
		const response = await this.send(kind, path, {});
		await response.text();
	}

	/** Runs every server load of the page, as an invalidate() refresh does. Returns the page node's data. */
	async data<T>(kind: string, path: string): Promise<T> {
		const response = await this.send(kind, `${path.replace(/\/$/, '')}/__data.json`, {});
		const body = (await response.json()) as {
			type: string;
			nodes: ({ type: string; data: unknown[] } | null)[];
		};
		const failed = body.type !== 'data' || body.nodes.some((node) => node?.type === 'error');
		if (failed) throw new Error(`${kind} ${path}: ${JSON.stringify(body).slice(0, 300)}`);
		const nodes = body.nodes.flatMap((node) => (node?.type === 'data' ? [node] : []));
		const merged = Object.assign({}, ...nodes.map((node) => unflatten(node.data)));
		return merged as T;
	}

	async action<T>(
		kind: string,
		path: string,
		name: string,
		fields: Record<string, string | number>
	): Promise<ActionResult<T>> {
		const form = new URLSearchParams();
		for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
		const response = await this.send(kind, `${path}?/${name}`, {
			method: 'POST',
			headers: { 'x-sveltekit-action': 'true', origin: this.baseUrl },
			body: form
		});
		const body = (await response.json()) as { status?: number; data?: string };
		return {
			status: body.status ?? response.status,
			data: (body.data ? parse(body.data) : {}) as T
		};
	}

	private async send(kind: string, path: string, init: RequestInit): Promise<Response> {
		const startedAt = performance.now();
		const response = await fetch(new URL(path, this.baseUrl), {
			redirect: 'manual',
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			...init
		}).catch((error: unknown) => {
			this.samples.push({
				...NO_RESPONSE,
				phase: this.phase,
				kind,
				startedAt,
				ms: performance.now() - startedAt
			});
			throw new Error(`${kind} ${path}: ${error instanceof Error ? error.message : error}`);
		});
		const usage = USAGE.exec(response.headers.get('server-timing') ?? '');
		// Form actions answer 200 with the action's own status inside the body.
		const status =
			response.status === 200 && init.method === 'POST'
				? await actionStatus(response.clone())
				: response.status;
		this.samples.push({
			phase: this.phase,
			kind,
			startedAt,
			ms: performance.now() - startedAt,
			status,
			calls: Number(usage?.[1] ?? 0),
			queries: Number(usage?.[2] ?? 0),
			rowsRead: Number(usage?.[3] ?? 0),
			rowsWritten: Number(usage?.[4] ?? 0),
			unmeasured: !usage
		});
		return response;
	}
}

async function actionStatus(response: Response): Promise<number> {
	const body = (await response.json()) as { status?: number };
	return body.status ?? response.status;
}
