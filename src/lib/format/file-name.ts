// Characters Windows, macOS or Linux refuse or treat as separators, and control characters.
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\u0000-\u001f\u007f/\\:*?"<>|]/g;

/** A name safe as one file or folder name on any common file system, at most maxLength characters. */
export function safeFileName(name: string, fallback: string, maxLength = 80): string {
	const cleaned = trim(name.replace(UNSAFE, ' ').replace(/\s+/g, ' '));
	const capped = trim(Array.from(cleaned).slice(0, maxLength).join(''));
	return capped || fallback;
}

// Leading dots hide a file and trailing dots vanish on Windows.
function trim(name: string): string {
	return name.replace(/^[\s.]+|[\s.]+$/g, '');
}
