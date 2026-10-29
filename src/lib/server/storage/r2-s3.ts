/** Not a secret. Change it when deploying to another Cloudflare account. */
export const R2_ACCOUNT_ID = 'd9dadbaab2ed0356e8cd981e4456ff4a';

/** Must match `bucket_name` of the MEDIA binding in wrangler.jsonc. */
export const MEDIA_BUCKET_NAME = 'huntboard-media';

/** Where phones upload claim media with a presigned URL. The CSP in vite.config.ts allows it. */
export const R2_S3_ORIGIN = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
