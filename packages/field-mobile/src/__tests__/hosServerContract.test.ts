import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { ALL_STANDBY_REASON_CODES } from '../screens/hos/hos-standby-reasons.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENUMS = path.resolve(
    here,
    '../../../../apps/operations/app/Modules/HoursOfService/Enums',
);

/** The string values of a PHP backed enum, read straight from the server. */
const serverEnumValues = (file: string): string[] =>
    [
        ...fs
            .readFileSync(path.join(SERVER_ENUMS, file), 'utf8')
            .matchAll(/case\s+\w+\s*=\s*'([^']+)'/g),
    ].map((match) => match[1]);

test('every standby reason the phone offers exists on the server', () => {
    const server = serverEnumValues('StandbyReason.php');

    assert.ok(server.length > 0, 'read the server enum');
    assert.deepEqual([...ALL_STANDBY_REASON_CODES].sort(), [...server].sort());
});

test('every duty status the phone sends exists on the server', () => {
    const server = serverEnumValues('DutyStatus.php');

    for (const status of [
        'operating',
        'driving',
        'standby',
        'on_break',
        'off_duty',
    ]) {
        assert.ok(server.includes(status), status);
    }
});
