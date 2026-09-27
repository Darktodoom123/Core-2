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
    'components/cards/JobListItemCard.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'components', 'cards', 'job-card'))
        .map((file) => `components/cards/job-card/${file}`),
    ...fs
        .readdirSync(path.join(SRC, 'components', 'fuel'))
        .map((file) => `components/fuel/${file}`),
    ...fs
        .readdirSync(path.join(SRC, 'components', 'home'))
        .map((file) => `components/home/${file}`),
    ...fs
        .readdirSync(path.join(SRC, 'components', 'inspection', 'defects'))
        .map((file) => `components/inspection/defects/${file}`),
    'components/inspection/DvirWalkaroundPhotos.tsx',
    'components/inspection/use-photo-capture.ts',
    'components/layout/field-header.tsx',
    'components/layout/profile-summary.tsx',
    'components/layout/sync-status-pill.tsx',
    'components/layout/tile-screen-header.tsx',
    'components/sheets/OutboxStatusSheet.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'components', 'sheets', 'outbox'))
        .map((file) => `components/sheets/outbox/${file}`),
    'components/sheets/ReliefHandoverModal.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'components', 'sheets', 'relief-handover'))
        .map((file) => `components/sheets/relief-handover/${file}`),
    ...fs
        .readdirSync(
            path.join(SRC, 'components', 'sheets', 'replacement-request'),
        )
        .map((file) => `components/sheets/replacement-request/${file}`),
    'components/sheets/ReportDelayModal.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'components', 'sheets', 'report-delay'))
        .map((file) => `components/sheets/report-delay/${file}`),
    'screens/DispatchOrdersScreen.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'dispatch'))
        .map((file) => `screens/dispatch/${file}`),
    'screens/DocumentsWalletScreen.tsx',
    'screens/FuelScreen.tsx',
    'screens/MachineProfileScreen.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'machine-profile'))
        .map((file) => `screens/machine-profile/${file}`),
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'documents'))
        .map((file) => `screens/documents/${file}`),
    'screens/DvirScreen.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'dvir'))
        .map((file) => `screens/dvir/${file}`),
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'safety'))
        .map((file) => `screens/safety/${file}`),
    'screens/HosScreen.tsx',
    'screens/profile/ProfileScreen.tsx',
    ...fs
        .readdirSync(path.join(SRC, 'screens', 'profile', 'components'))
        .map((file) => `screens/profile/components/${file}`),
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
