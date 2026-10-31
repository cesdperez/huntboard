import { encode } from 'uqr';

/** The light margin in modules that the QR spec asks for, so a dark or patterned page cannot hide the code's edge. */
export const QUIET_ZONE = 4;

/** Dark colours on white. `logo` is the image URL drawn at the centre. */
export interface QrStyle {
	ink: string;
	eye: string;
	logo: string;
}

const FINDER = 7;
// H recovers 30% of the codewords, and the cleared centre costs about 10%: the scan test holds the margin.
const LOGO_SHARE = 0.32;
const DOT_RADIUS = 0.5;

/** A QR code as SVG markup: rounded modules, rounded finder eyes and the logo on a cleared light pad. */
export function qrSvg(text: string, style: QrStyle): string {
	const { size, data } = encode(text, { ecc: 'H', border: QUIET_ZONE });
	const inner = size - 2 * QUIET_ZONE;
	const eyes = [
		[QUIET_ZONE, QUIET_ZONE],
		[size - QUIET_ZONE - FINDER, QUIET_ZONE],
		[QUIET_ZONE, size - QUIET_ZONE - FINDER]
	];
	const pad = logoPad(size, inner);

	const isEye = (x: number, y: number) =>
		eyes.some(([ex, ey]) => x >= ex && x < ex + FINDER && y >= ey && y < ey + FINDER);
	const isUnderLogo = (x: number, y: number) =>
		x >= pad.start && x < pad.end && y >= pad.start && y < pad.end;

	const isModule = (x: number, y: number) =>
		Boolean(data[y]?.[x]) && !isEye(x, y) && !isUnderLogo(x, y);
	let dots = '';
	let bridges = '';
	data.forEach((row, y) =>
		row.forEach((_, x) => {
			if (!isModule(x, y)) return;
			dots += dot(x, y);
			if (isModule(x + 1, y)) bridges += `M${x + 0.5} ${y}h1v1h-1z`;
			if (isModule(x, y + 1)) bridges += `M${x} ${y + 0.5}h1v1h-1z`;
		})
	);
	const rings = eyes.map(([x, y]) => rect(x, y, 7, 2) + rect(x + 1, y + 1, 5, 1.4)).join('');
	const pupils = eyes.map(([x, y]) => rect(x + 2, y + 2, 3, 1)).join('');
	const side = pad.end - pad.start;
	const logoInset = 0.5;

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">` +
		`<rect width="${size}" height="${size}" fill="#ffffff"/>` +
		`<path d="${dots}" fill="${style.ink}"/>` +
		`<path d="${bridges}" fill="${style.ink}"/>` +
		`<path d="${rings}" fill="${style.eye}" fill-rule="evenodd"/>` +
		`<path d="${pupils}" fill="${style.ink}"/>` +
		`<path d="${rect(pad.start, pad.start, side, 1.5)}" fill="#ffffff"/>` +
		`<image href="${style.logo}" x="${pad.start + logoInset}" y="${pad.start + logoInset}" ` +
		`width="${side - 2 * logoInset}" height="${side - 2 * logoInset}"/>` +
		`</svg>`
	);
}

// An odd side keeps the pad on whole modules around the centre one.
function logoPad(size: number, inner: number) {
	const side = Math.round((inner * LOGO_SHARE) / 2) * 2 + 1;
	const start = (size - side) / 2;
	return { start, end: start + side };
}

function dot(x: number, y: number): string {
	const r = DOT_RADIUS;
	return `M${x + 0.5 - r} ${y + 0.5}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

function rect(x: number, y: number, side: number, r: number): string {
	const s = side - 2 * r;
	return (
		`M${x + r} ${y}h${s}a${r} ${r} 0 0 1 ${r} ${r}v${s}a${r} ${r} 0 0 1 ${-r} ${r}` +
		`h${-s}a${r} ${r} 0 0 1 ${-r} ${-r}v${-s}a${r} ${r} 0 0 1 ${r} ${-r}z`
	);
}
