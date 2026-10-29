import { encode } from 'uqr';

/** The light margin in modules that the QR spec asks for, so a dark or patterned page cannot hide the code's edge. */
export const QUIET_ZONE = 4;

/** A QR code as an SVG path of dark modules on a `size` × `size` grid, quiet zone included. */
export type QrCode = { size: number; path: string };

export function qrCode(text: string): QrCode {
	// M survives glare and a dirty big screen better than the library's default L.
	const { size, data } = encode(text, { ecc: 'M', border: QUIET_ZONE });
	return { size, path: data.map(rowPath).join('') };
}

function rowPath(row: boolean[], y: number): string {
	let path = '';
	let x = 0;
	while (x < row.length) {
		if (!row[x]) {
			x++;
			continue;
		}
		const start = x;
		while (row[x]) x++;
		path += `M${start} ${y}h${x - start}v1h-${x - start}z`;
	}
	return path;
}
