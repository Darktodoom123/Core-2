import type { SignatureStroke } from './DigitalSignatureModal';

const PADDING = 8;

const round = (value: number) => Math.round(value * 10) / 10;

/** The pen strokes as SVG markup, cropped to the ink. Null with no ink. */
export function signatureSvg(strokes: SignatureStroke[]): string | null {
    const points = strokes
        .flat()
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (points.length === 0) {
        return null;
    }

    const minX = Math.min(...points.map((p) => p.x)) - PADDING;
    const minY = Math.min(...points.map((p) => p.y)) - PADDING;
    const width = Math.max(...points.map((p) => p.x)) - minX + PADDING;
    const height = Math.max(...points.map((p) => p.y)) - minY + PADDING;
    const lines = strokes
        .filter((stroke) => stroke.length > 0)
        .map((stroke) => {
            const path = stroke
                .map((p) => `${round(p.x - minX)},${round(p.y - minY)}`)
                .join(' ');

            return `<polyline points="${path}"/>`;
        })
        .join('');

    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${round(width)} ${round(height)}">` +
        `<g fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${lines}</g></svg>`
    );
}

/** A data URI a browser can show as an image, or null with no ink. */
export function signatureSvgDataUri(strokes: SignatureStroke[]): string | null {
    const svg = signatureSvg(strokes);

    if (!svg) {
        return null;
    }

    const encoded =
        typeof btoa === 'function'
            ? btoa(svg)
            : Buffer.from(svg, 'utf-8').toString('base64');

    return `data:image/svg+xml;base64,${encoded}`;
}
