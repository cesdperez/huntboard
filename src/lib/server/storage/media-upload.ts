import { AwsV4Signer } from 'aws4fetch';
import type { MediaType } from '#lib/domain/claim-media.js';
import { MEDIA_BUCKET_NAME, R2_S3_ORIGIN } from './r2-s3.js';

export const UPLOAD_URL_SECONDS = 15 * 60;

/** Where the browser PUTs the file, and the headers it must send. It sets Content-Length itself. */
export interface MediaUploadTarget {
	url: string;
	headers: Record<string, string>;
}

/** Signs one upload of exactly this key, content type and size, valid for UPLOAD_URL_SECONDS. */
export type MediaPresigner = (
	key: string,
	type: MediaType,
	size: number,
	now: Date
) => Promise<MediaUploadTarget>;

export interface R2Credentials {
	accessKeyId: string;
	secretAccessKey: string;
}

/** A presigned S3 PUT to the media bucket. R2 refuses a body of another type or size. */
export function r2Presigner({ accessKeyId, secretAccessKey }: R2Credentials): MediaPresigner {
	return async (key, type, size, now) => {
		const url = new URL(`${R2_S3_ORIGIN}/${MEDIA_BUCKET_NAME}/${key}`);
		url.searchParams.set('X-Amz-Expires', String(UPLOAD_URL_SECONDS));
		const signer = new AwsV4Signer({
			method: 'PUT',
			url: url.href,
			headers: { 'Content-Type': type, 'Content-Length': String(size) },
			accessKeyId,
			secretAccessKey,
			service: 's3',
			region: 'auto',
			datetime: now.toISOString().replace(/[:-]|\.\d{3}/g, ''),
			signQuery: true,
			// aws4fetch leaves Content-Type and Content-Length unsigned unless told otherwise.
			allHeaders: true
		});
		const signed = await signer.sign();
		return { url: signed.url.href, headers: { 'Content-Type': type } };
	};
}
