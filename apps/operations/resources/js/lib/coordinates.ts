/** Six decimals (~0.1 m): never rounds away real GPS precision. */
export function formatCoordinates(latitude: number, longitude: number): string {
    return `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`;
}
