import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Screens migrated to theme tokens. Add each screen here as it is migrated
// (see "Known deviations" in Docs/design/mobile.md).
const MIGRATED = [
    'components/cards/AssignmentResponseCard.tsx',
    'components/layout/field-header.tsx',
    'components/layout/profile-summary.tsx',
    'components/layout/sync-status-pill.tsx',
    'components/layout/tile-screen-header.tsx',
    'screens/DispatchOrdersScreen.tsx',
    'screens/DvirScreen.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'dvir'))
        .map((file) => `screens/dvir/${file}`),
    'screens/HosScreen.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'hos'))
        .map((file) => `screens/hos/${file}`),
];

const HEX_OR_RGBA = /['"]#[0-9A-Fa-f]{3,8}['"]|rgba?\(/;

describe('Design token adoption', () => {
    for (const file of MIGRATED) {
        test(`${file} takes colors from useTheme() tokens only`, () => {
            const source = fs.readFileSync(path.join(SRC, file), 'utf8');
            const offending = source
                .split('\n')
                .map((line, index) => ({ line, number: index + 1 }))
                .filter(({ line }) => HEX_OR_RGBA.test(line));

            assert.deepEqual(
                offending.map(
                    ({ number, line }) => `${number}: ${line.trim()}`,
                ),
                [],
            );
            assert.doesNotMatch(source, /from '[./]*components\/nativeStyles'/);
        });
    }
});
