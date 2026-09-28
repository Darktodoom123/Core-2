import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Locations must come from real devices, users, or geocoding — never from
 * coordinates written into application code. The company yard is the one
 * deliberate, documented fixed facility.
 */
const REPO = path.resolve(__dirname, '../../../../..');
const ROOTS = [
    'apps/operations/resources/js',
    'apps/operations/app',
    'packages/field-mobile/src',
];
const ALLOWED = new Set([
    'apps/operations/resources/js/components/maplibre/warehouse-location.ts',
]);
const SKIP_DIRS = new Set(['__tests__', 'Testing', 'node_modules']);

// A latitude/longitude pair, a [lon, lat] tuple, or lat/lng assigned a literal.
const COORDINATE_LITERAL =
    /\b-?\d{1,2}\.\d{3,}\s*,\s*-?1?\d{1,2}\.\d{3,}|\[\s*-?1\d{2}\.\d{2,}\s*,\s*-?\d{1,2}\.\d{1,}\s*\]|\b(?:lat|lng|lon|latitude|longitude)\b['"]?\s*(?::|=|=>)\s*-?\d{1,3}\.\d{2,}/i;

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return SKIP_DIRS.has(entry.name) ? [] : sourceFiles(full);
        }

        return /\.(tsx?|php)$/.test(entry.name) &&
            !/\.test\.tsx?$/.test(entry.name)
            ? [full]
            : [];
    });
}

describe('No hardcoded coordinates', () => {
    it('keeps coordinate literals out of application code (except the company yard)', () => {
        const offenders = ROOTS.flatMap((root) =>
            sourceFiles(path.join(REPO, root)),
        ).flatMap((file) => {
            const relative = path
                .relative(REPO, file)
                .split(path.sep)
                .join('/');

            if (ALLOWED.has(relative)) {
                return [];
            }

            return fs
                .readFileSync(file, 'utf8')
                .split('\n')
                .flatMap((line, index) =>
                    COORDINATE_LITERAL.test(line)
                        ? [`${relative}:${index + 1}: ${line.trim()}`]
                        : [],
                );
        });

        expect(offenders).toEqual([]);
    });
});
