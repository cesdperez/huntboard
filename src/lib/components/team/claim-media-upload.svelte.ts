import { deserialize } from '$app/forms';
import { resultUnder } from '#lib/action-results.js';
import { classifyMedia, prepareClaimMedia } from '#lib/client/claim-media.js';
import { putFile } from '#lib/client/media-upload.js';
import { isVideoType, type MediaKind } from '#lib/domain/claim-media.js';
import type { GamePhase } from '#lib/domain/game-window.js';
import { actionFailureMessage, RETRY } from './action-message.js';

export type UploadPhase = 'idle' | 'preparing' | 'uploading' | 'ready' | 'failed';

/**
 * One photo or video on its way to a claim: compressed in the browser, presigned by the team
 * page's mediaUpload action, then PUT straight to storage. Mark done sends `key` once ready.
 */
export class ClaimMediaUpload {
	phase = $state<UploadPhase>('idle');
	kind = $state<MediaKind | null>(null);
	/** 0 to 1, or null while the step cannot tell how far it is. */
	progress = $state<number | null>(null);
	error = $state<string | null>(null);
	/** A blob: URL of the photo being sent, for its thumbnail. */
	preview = $state<string | null>(null);
	key = $state<string | null>(null);
	#controller: AbortController | null = null;
	readonly #closedMessage: (phase: Exclude<GamePhase, 'during'>) => string;

	constructor(closedMessage: (phase: Exclude<GamePhase, 'during'>) => string) {
		this.#closedMessage = closedMessage;
	}

	get busy(): boolean {
		return this.phase === 'preparing' || this.phase === 'uploading';
	}

	async start(file: File) {
		this.clear();
		const controller = new AbortController();
		this.#controller = controller;
		const { signal } = controller;
		const onProgress = (fraction: number) => {
			if (!signal.aborted) this.progress = fraction;
		};
		this.kind = classifyMedia(file) === 'video' ? 'video' : 'photo';
		this.phase = 'preparing';
		try {
			// Every await below can outlive a clear() or a newer start(), and not every step honours the signal.
			const prepared = await prepareClaimMedia(file, onProgress, signal);
			if (signal.aborted) return;
			if (!prepared.ok) return this.#fail(prepared.message);
			this.kind = isVideoType(prepared.type) ? 'video' : 'photo';
			if (this.kind === 'photo') this.preview = URL.createObjectURL(prepared.file);

			const target = await this.#presign(prepared.file, prepared.type, signal);
			if (signal.aborted) return;
			if (typeof target === 'string') return this.#fail(target);

			this.phase = 'uploading';
			this.progress = 0;
			const uploaded = await putFile(target.url, target.headers, prepared.file, onProgress, signal);
			if (signal.aborted) return;
			if (!uploaded) return this.#fail(RETRY);
			this.key = target.key;
			this.phase = 'ready';
		} catch (error) {
			if (signal.aborted) return;
			console.error('Attaching media failed', error);
			this.#fail(RETRY);
		}
	}

	/** Stops any step still running and forgets the file. */
	clear() {
		this.#controller?.abort();
		this.#controller = null;
		if (this.preview) URL.revokeObjectURL(this.preview);
		this.phase = 'idle';
		this.kind = null;
		this.progress = null;
		this.error = null;
		this.preview = null;
		this.key = null;
	}

	async #presign(file: File, type: string, signal: AbortSignal) {
		const data = new FormData();
		data.set('type', type);
		data.set('size', String(file.size));
		const response = await fetch('?/mediaUpload', {
			method: 'POST',
			body: data,
			headers: { 'x-sveltekit-action': 'true' },
			signal
		});
		const result = deserialize(await response.text());
		const message = actionFailureMessage(result, this.#closedMessage);
		if (message) return message;
		const team = result.type === 'success' ? resultUnder(result.data, 'team') : undefined;
		return team?.kind === 'media-upload' ? team : RETRY;
	}

	#fail(message: string) {
		this.phase = 'failed';
		this.progress = null;
		this.error = message;
	}
}
