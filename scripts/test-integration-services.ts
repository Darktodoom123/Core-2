import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import {
    FieldApiClient,
    ApiClientError,
} from '../packages/field-mobile/src/services/apiClient';

const execFileAsync = promisify(execFile);
const workspace = process.cwd();
const suffix =
    `${Date.now().toString(36)}${process.pid.toString(36)}`.toLowerCase();
const projectName = `core2-it-${suffix}`;
const composeFile = join(workspace, 'docker-compose.yml');
const envFile = join(tmpdir(), `${projectName}.env`);
const operationsPort = 18_000 + Math.floor(Math.random() * 1_000);

const appKey = `base64:${randomBytes(32).toString('base64')}`;
const trackingAppKey = `base64:${randomBytes(32).toString('base64')}`;
const serviceSecret = randomBytes(32).toString('hex');
const operationsDatabase = `core2_ops_${suffix}`;
const trackingDatabase = `core2_tracking_${suffix}`;
const operationsUser = `ops_${suffix}`;
const trackingUser = `tracking_${suffix}`;
const operationsPassword = randomBytes(24).toString('base64url');
const trackingPassword = randomBytes(24).toString('base64url');

const reverbAppId = `core2-it-${suffix}`;
const reverbAppKey = `core2-it-key-${suffix}`;
const reverbAppSecret = randomBytes(24).toString('hex');

const hostEnvironment: NodeJS.ProcessEnv = {};

for (const key of [
    'ComSpec',
    'HOME',
    'HOMEDRIVE',
    'HOMEPATH',
    'PATH',
    'PROGRAMDATA',
    'ProgramFiles',
    'ProgramFiles(x86)',
    'SystemRoot',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'WINDIR',
]) {
    const value = process.env[key];

    if (value !== undefined) {
        hostEnvironment[key] = value;
    }
}

let authToken: string | null = null;
let stackAttempted = false;

type CommandResult = { stdout: string; stderr: string };

async function docker(
    args: string[],
    timeoutMs = 30_000,
): Promise<CommandResult> {
    try {
        return await execFileAsync('docker', args, {
            cwd: workspace,
            env: hostEnvironment,
            windowsHide: true,
            timeout: timeoutMs,
            maxBuffer: 8 * 1024 * 1024,
        });
    } catch (error) {
        const details = error as {
            message?: string;
            stdout?: string;
            stderr?: string;
        };
        const output = [details.stderr, details.stdout]
            .filter(
                (part): part is string =>
                    typeof part === 'string' && part.trim() !== '',
            )
            .join('\n');

        if (output !== '') {
            details.message = `${details.message ?? 'Docker command failed'}\n${output}`;
        }

        throw error;
    }
}

async function compose(
    args: string[],
    timeoutMs = 30_000,
): Promise<CommandResult> {
    return docker(
        [
            'compose',
            '--project-name',
            projectName,
            '--file',
            composeFile,
            '--env-file',
            envFile,
            ...args,
        ],
        timeoutMs,
    );
}

async function removeGeneratedContainers(): Promise<void> {
    const containerOutput = await docker([
        'ps',
        '--all',
        '--quiet',
        '--filter',
        `label=com.docker.compose.project=${projectName}`,
    ]);
    const containerIds = containerOutput.stdout.trim().split(/\s+/).filter(Boolean);

    if (containerIds.length > 0) {
        await docker(['rm', '--force', ...containerIds], 30_000);
    }
}

function redact(value: string): string {
    return [
        appKey,
        trackingAppKey,
        serviceSecret,
        operationsPassword,
        trackingPassword,
        operationsUser,
        trackingUser,
        reverbAppId,
        reverbAppKey,
        reverbAppSecret,
        authToken,
    ]
        .filter(
            (secret): secret is string =>
                typeof secret === 'string' && secret !== '',
        )
        .reduce(
            (redacted, secret) => redacted.replaceAll(secret, '[redacted]'),
            value,
        );
}

async function writeGeneratedEnvironment(): Promise<void> {
    const entries: Record<string, string> = {
        APP_ENV: 'testing',
        APP_KEY: appKey,
        APP_DEBUG: 'false',
        APP_URL: `http://127.0.0.1:${operationsPort}`,
        DB_CONNECTION: 'pgsql',
        DB_HOST: 'db',
        DB_PORT: '5432',
        DB_DATABASE: operationsDatabase,
        DB_USERNAME: operationsUser,
        DB_PASSWORD: operationsPassword,
        DB_SSLMODE: 'disable',
        TRACKING_APP_KEY: trackingAppKey,
        TRACKING_DB_CONNECTION: 'pgsql',
        TRACKING_DB_HOST: 'tracking-db',
        TRACKING_DB_PORT: '5432',
        TRACKING_DB_DATABASE: trackingDatabase,
        TRACKING_DB_USERNAME: trackingUser,
        TRACKING_DB_PASSWORD: trackingPassword,
        TRACKING_DB_SSLMODE: 'disable',
        TRACKING_SERVICE_DRIVER: 'http',
        TRACKING_SERVICE_URL: 'http://tracking',
        TRACKING_SERVICE_SECRET: serviceSecret,
        TRACKING_ALLOWED_SERVICES: 'operations',
        TRACKING_RUN_MIGRATIONS: 'true',
        TRACKING_CACHE_CONFIG: 'false',
        RUN_MIGRATIONS: 'true',
        CACHE_CONFIG: 'false',
        CACHE_STORE: 'file',
        QUEUE_CONNECTION: 'sync',
        SESSION_DRIVER: 'file',
        BROADCAST_CONNECTION: 'null',
        REVERB_APP_ID: reverbAppId,
        REVERB_APP_KEY: reverbAppKey,
        REVERB_APP_SECRET: reverbAppSecret,
        VITE_PUBLIC_REVERB_IDENTIFIER: reverbAppKey,
        VITE_REVERB_HOST: '127.0.0.1',
        VITE_REVERB_PORT: '8080',
        VITE_REVERB_SCHEME: 'http',
        PORT: String(operationsPort),
        REVERB_FORWARD_PORT: String(operationsPort + 1),
    };

    await writeFile(
        envFile,
        Object.entries(entries)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n') + '\n',
        { encoding: 'utf8', mode: 0o600 },
    );
}

async function fetchJson(
    url: string,
    init: RequestInit = {},
): Promise<{ status: number; body: any }> {
    const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(init.headers ?? {}),
        },
    });
    const text = await response.text();
    let body: any = {};

    if (text !== '') {
        try {
            body = JSON.parse(text);
        } catch {
            body = { raw: text };
        }
    }

    return { status: response.status, body };
}

async function waitForHealthy(
    services: string[],
    timeoutSeconds = 180,
): Promise<void> {
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
        let healthy = true;

        for (const service of services) {
            const container = (
                await compose(['ps', '-q', service])
            ).stdout.trim();

            if (container === '') {
                healthy = false;
                continue;
            }

            const status = (
                await docker([
                    'inspect',
                    '--format',
                    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
                    container,
                ])
            ).stdout.trim();

            if (status !== 'healthy') {
                healthy = false;
            }
        }

        if (healthy) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    throw new Error(
        `Timed out waiting for healthy services: ${services.join(', ')}`,
    );
}

async function seedOperations(): Promise<void> {
    await compose(
        [
            'exec',
            '-T',
            'app',
            'php',
            'artisan',
            'db:seed',
            '--class=DatabaseSeeder',
            '--force',
            '--no-interaction',
        ],
        120_000,
    );
    await compose(
        [
            'exec',
            '-T',
            'app',
            'php',
            'artisan',
            'db:seed',
            '--class=OperationalTestSeeder',
            '--force',
            '--no-interaction',
        ],
        120_000,
    );
    await compose(
        [
            'exec',
            '-T',
            'app',
            'php',
            'artisan',
            'db:seed',
            '--class=BrowserAcceptanceSeeder',
            '--force',
            '--no-interaction',
        ],
        120_000,
    );
}

async function queryDatabase(service: string, sql: string): Promise<string> {
    const username = service === 'tracking-db' ? trackingUser : operationsUser;
    const database =
        service === 'tracking-db' ? trackingDatabase : operationsDatabase;

    return (
        await compose(
            [
                'exec',
                '-T',
                service,
                'psql',
                '-U',
                username,
                '-d',
                database,
                '-Atqc',
                sql,
            ],
            30_000,
        )
    ).stdout.trim();
}

function jsonBody(body: unknown): string {
    return JSON.stringify(body);
}

type TrackingRequestOptions = {
    body?: string;
    headers?: Record<string, string>;
};

function trackingSignatureHeaders(
    method: string,
    path: string,
    rawBody = '',
    timestamp = Math.floor(Date.now() / 1000),
): Record<string, string> {
    const digest = createHash('sha256').update(rawBody).digest('hex');
    const canonicalPath = `/${path.replace(/^\/+|\/+$/g, '')}`;
    const signature = createHmac('sha256', serviceSecret)
        .update(
            `${method.toUpperCase()}\n${canonicalPath}\n${timestamp}\n${digest}`,
        )
        .digest('hex');

    return {
        'X-Service-Name': 'operations',
        'X-Timestamp': String(timestamp),
        'X-Payload-Digest': digest,
        'X-Signature': signature,
        Accept: 'application/json',
    };
}

async function trackingRequest(
    method: string,
    path: string,
    options: TrackingRequestOptions = {},
): Promise<{ status: number; body: any }> {
    const requestPath = new URL(path, 'http://tracking').pathname;
    const rawBody = options.body ?? '';
    const headers =
        options.headers ??
        trackingSignatureHeaders(method, requestPath, rawBody);
    const args = [
        'exec',
        '-T',
        'tracking',
        'curl',
        '--silent',
        '--show-error',
        '--request',
        method,
    ];

    for (const [name, value] of Object.entries(headers)) {
        args.push('--header', `${name}: ${value}`);
    }

    if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
        args.push('--data-raw', rawBody);
    }

    args.push('--write-out', '\n%{http_code}', `http://127.0.0.1${path}`);
    const output = (await compose(args, 30_000)).stdout;
    const statusMatch = output.match(/\n(\d{3})\s*$/);

    if (statusMatch === null) {
        throw new Error(
            `Tracking request did not return an HTTP status for ${method} ${path}.`,
        );
    }

    const text = output.slice(0, statusMatch.index).trim();
    let body: any = {};

    if (text !== '') {
        try {
            body = JSON.parse(text);
        } catch {
            body = { raw: text };
        }
    }

    return { status: Number(statusMatch[1]), body };
}

async function runTrackingReadContract(
    userId: number,
    assetId: number,
    jobId: number,
    commandIds: string[],
): Promise<void> {
    const unsigned = await trackingRequest(
        'GET',
        '/internal/v1/locations/latest',
        {
            headers: {},
        },
    );
    assert.equal(
        unsigned.status,
        401,
        'unsigned Tracking reads must be rejected',
    );

    const disallowedHeaders = trackingSignatureHeaders(
        'GET',
        '/internal/v1/locations/latest',
    );
    disallowedHeaders['X-Service-Name'] = 'untrusted-service';
    const disallowed = await trackingRequest(
        'GET',
        '/internal/v1/locations/latest',
        { headers: disallowedHeaders },
    );
    assert.equal(
        disallowed.status,
        403,
        'Tracking must reject a signed request from a disallowed service',
    );

    const expired = await trackingRequest(
        'GET',
        '/internal/v1/locations/latest',
        {
            headers: trackingSignatureHeaders(
                'GET',
                '/internal/v1/locations/latest',
                '',
                Math.floor(Date.now() / 1000) - 301,
            ),
        },
    );
    assert.equal(
        expired.status,
        401,
        'expired Tracking reads must be rejected',
    );

    const forgedHeaders = trackingSignatureHeaders(
        'GET',
        '/internal/v1/locations/latest',
    );
    forgedHeaders['X-Signature'] = '0'.repeat(64);
    const forged = await trackingRequest(
        'GET',
        '/internal/v1/locations/latest',
        {
            headers: forgedHeaders,
        },
    );
    assert.equal(forged.status, 401, 'forged Tracking reads must be rejected');

    const query = `?user_id=${userId}&operational_asset_id=${assetId}&dispatch_job_id=${jobId}`;
    const latest = await trackingRequest(
        'GET',
        `/internal/v1/locations/latest${query}`,
    );
    assert.equal(latest.status, 200);
    assert.ok(Array.isArray(latest.body?.data));
    assert.equal(latest.body.data.length, 1);
    assert.equal(latest.body.data[0]?.user_id, userId);
    assert.equal(latest.body.data[0]?.operational_asset_id, assetId);

    const history = await trackingRequest(
        'GET',
        `/internal/v1/locations/history${query}&limit=10`,
    );
    assert.equal(history.status, 200);
    assert.ok(Array.isArray(history.body?.data));

    for (const commandId of commandIds) {
        assert.ok(
            history.body.data.some(
                (sample: { command_id?: string }) =>
                    sample.command_id === commandId,
            ),
            `Tracking history is missing command ${commandId}`,
        );
    }

    const rangeQuery = `?date_from=${encodeURIComponent(new Date(Date.now() - 86400 * 1000).toISOString())}&limit=20`;
    const rangeExport = await trackingRequest(
        'GET',
        `/internal/v1/locations${rangeQuery}`,
    );
    assert.equal(rangeExport.status, 200, 'Tracking range export query failed');
    assert.ok(Array.isArray(rangeExport.body?.data), 'Range export data must be an array');
    assert.ok(
        rangeExport.body.data.length >= commandIds.length,
        'Range export must include ingested samples',
    );
}

async function exerciseMobileBoundary(): Promise<void> {
    const baseUrl = `http://127.0.0.1:${operationsPort}`;
    const userId = Number(
        await queryDatabase(
            'db',
            "SELECT id FROM users WHERE username = 'operator' LIMIT 1",
        ),
    );
    const assetId = Number(
        await queryDatabase(
            'db',
            "SELECT id FROM operational_assets WHERE code = 'CRN-101' LIMIT 1",
        ),
    );
    const jobId = Number(
        await queryDatabase(
            'db',
            "SELECT id FROM dispatch_jobs WHERE reference = 'DSP-2026-0891' LIMIT 1",
        ),
    );
    assert.ok(
        Number.isInteger(userId) && userId > 0,
        'Operational operator fixture must exist',
    );
    assert.ok(
        Number.isInteger(assetId) && assetId > 0,
        'Operational crane fixture must exist',
    );
    assert.ok(
        Number.isInteger(jobId) && jobId > 0,
        'Operational dispatch fixture must exist',
    );

    const opsUp = await fetchJson(`${baseUrl}/up`);
    assert.equal(opsUp.status, 200, 'Operations /up health check failed');

    const opsReady = await fetchJson(`${baseUrl}/ready`);
    assert.equal(opsReady.status, 200, 'Operations /ready readiness check failed');
    assert.equal(opsReady.body?.status, 'ready', 'Operations must report ready');
    assert.equal(opsReady.body?.database, 'ok', 'Operations database must be ok');
    assert.equal(opsReady.body?.migrations, 'ok', 'Operations migrations must be ok');

    const trackingUp = await trackingRequest('GET', '/up', { headers: {} });
    assert.equal(trackingUp.status, 200, 'Tracking /up health check failed');

    const trackingReady = await trackingRequest('GET', '/ready', { headers: {} });
    assert.equal(trackingReady.status, 200, 'Tracking /ready readiness check failed');
    assert.equal(trackingReady.body?.status, 'ready', 'Tracking must report ready');
    assert.equal(trackingReady.body?.database, 'ok', 'Tracking database must be ok');
    assert.equal(trackingReady.body?.migrations, 'ok', 'Tracking migrations must be ok');

    const login = await fetchJson(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        body: jsonBody({
            username: 'operator',
            password: 'password',
            device_name: `core2-it-${suffix}`,
        }),
    });
    assert.equal(login.status, 200, `login failed with status ${login.status}`);
    const token = login.body?.data?.token;
    assert.equal(typeof token, 'string');
    authToken = token;

    const client = new FieldApiClient({
        baseUrl,
        getToken: () => authToken,
        fetchFn: fetch,
    });
    const firstCommand = randomUUID();
    const firstPayload = {
        latitude: 14.5547,
        longitude: 121.0244,
        accuracy_metres: 2.5,
        sharing_enabled: true,
        captured_at: new Date().toISOString(),
        operational_asset_id: assetId,
        dispatch_job_id: jobId,
        remarks: 'integration boundary sample',
    };

    const first = await client.shareLocation(firstPayload, firstCommand);
    assert.equal(typeof first, 'object');
    assert.equal(
        await queryDatabase(
            'tracking-db',
            `SELECT count(*) FROM location_samples WHERE command_id = '${firstCommand}'`,
        ),
        '1',
    );
    assert.equal(
        await queryDatabase(
            'tracking-db',
            `SELECT count(*) FROM tracking_command_receipts WHERE command_id = '${firstCommand}'`,
        ),
        '1',
    );
    assert.equal(
        await queryDatabase(
            'db',
            `SELECT count(*) FROM location_updates WHERE user_id = ${userId} AND operational_asset_id = ${assetId} AND remarks = 'integration boundary sample'`,
        ),
        '0',
        'successful Tracking ingestion must not silently write the Operations fallback table',
    );

    await client.shareLocation(firstPayload, firstCommand);
    assert.equal(
        await queryDatabase(
            'tracking-db',
            `SELECT count(*) FROM location_samples WHERE command_id = '${firstCommand}'`,
        ),
        '1',
    );

    await assert.rejects(
        client.shareLocation({ ...firstPayload, latitude: 14.6 }, firstCommand),
        (error: unknown) =>
            error instanceof ApiClientError &&
            (error.status === 409 || error.status === 422),
    );
    assert.equal(
        await queryDatabase(
            'tracking-db',
            `SELECT count(*) FROM location_samples WHERE command_id = '${firstCommand}'`,
        ),
        '1',
    );

    await compose(['stop', 'tracking']);
    const outageCommand = randomUUID();
    await client.shareLocation(
        { ...firstPayload, latitude: 14.555, longitude: 121.025 },
        outageCommand,
    );
    assert.equal(
        await queryDatabase(
            'db',
            `SELECT count(*) FROM location_updates WHERE user_id = ${userId} AND operational_asset_id = ${assetId} AND remarks = 'integration boundary sample'`,
        ),
        '1',
    );

    await runPlaywright(baseUrl, true);

    await compose(['start', 'tracking']);
    await waitForHealthy(['db', 'redis', 'tracking-db', 'tracking', 'app']);

    const recoveryCommand = randomUUID();
    await client.shareLocation(
        { ...firstPayload, latitude: 14.556, longitude: 121.026 },
        recoveryCommand,
    );
    assert.equal(
        await queryDatabase(
            'tracking-db',
            `SELECT count(*) FROM location_samples WHERE command_id = '${recoveryCommand}'`,
        ),
        '1',
    );
    await runTrackingReadContract(userId, assetId, jobId, [
        firstCommand,
        recoveryCommand,
    ]);

    await runPlaywright(baseUrl, false);

    const oldSample = await queryDatabase(
        'tracking-db',
        "INSERT INTO location_samples (user_id, latitude, longitude, sharing_enabled, source, captured_at, received_at, created_at, updated_at) VALUES (999999, 1.0, 2.0, true, 'integration', NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days') RETURNING id",
    );
    assert.notEqual(oldSample, '');
    await compose(
        [
            'exec',
            '-T',
            'tracking',
            'php',
            'artisan',
            'location:prune',
            '--no-interaction',
        ],
        60_000,
    );
    assert.equal(
        await queryDatabase(
            'tracking-db',
            `SELECT count(*) FROM location_samples WHERE id = ${oldSample} AND latitude IS NULL AND longitude IS NULL`,
        ),
        '1',
    );
}

async function runPlaywright(baseUrl: string, outage: boolean): Promise<void> {
    const playwrightCli = join(
        workspace,
        'node_modules',
        '@playwright',
        'test',
        'cli.js',
    );

    try {
        const result = await execFileAsync(
            process.execPath,
            [
                playwrightCli,
                'test',
                'apps/operations/tests/Browser/service-stack.spec.ts',
            ],
            {
                cwd: workspace,
                env: {
                    ...hostEnvironment,
                    PLAYWRIGHT_BASE_URL: baseUrl,
                    CORE2_TRACKING_OUTAGE: outage ? 'true' : 'false',
                },
                windowsHide: true,
                timeout: 180_000,
                maxBuffer: 16 * 1024 * 1024,
            },
        );

        if (result.stdout.trim() !== '') {
            console.log(result.stdout.trim());
        }
    } catch (error) {
        const details = error as {
            message?: string;
            stdout?: string;
            stderr?: string;
        };

        throw new Error(
            `Playwright service-stack check failed (${outage ? 'outage' : 'active'}): ${[
                details.message,
                details.stdout,
                details.stderr,
            ]
                .filter(
                    (part): part is string =>
                        typeof part === 'string' && part !== '',
                )
                .join('\n')}`,
        );
    }
}

async function main(): Promise<void> {
    await writeGeneratedEnvironment();
    await docker(['info'], 30_000);
    const buildFlag =
        process.env.CORE2_INTEGRATION_NO_BUILD === 'true'
            ? '--no-build'
            : '--build';

    stackAttempted = true;
    await compose(
        [
            'up',
            buildFlag,
            '--detach',
            'db',
            'redis',
            'tracking-db',
            'tracking',
            'app',
        ],
        900_000,
    );
    await waitForHealthy(['db', 'redis', 'tracking-db', 'tracking', 'app']);
    await seedOperations();
    await exerciseMobileBoundary();
    console.log(`Integration services passed (${projectName}).`);
}

let failure: unknown;

try {
    await main();
} catch (error) {
    failure = error;
    const detail =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
    let logs = '';

    try {
        logs = (
            await compose([
                'logs',
                '--no-color',
                '--tail',
                '80',
                'app',
                'tracking',
                'db',
                'tracking-db',
            ])
        ).stdout;
    } catch (logError) {
        logs = `Unable to collect service logs: ${String(logError)}`;
    }

    const logPath = join(tmpdir(), `${projectName}.log`);
    await writeFile(logPath, `${redact(detail)}\n\n${redact(logs)}`, 'utf8');
    console.error(`Integration services failed. Local log: ${logPath}`);
    console.error(redact(detail));
} finally {
    if (stackAttempted) {
        try {
            await compose(['down', '--remove-orphans'], 120_000);
        } catch (error) {
            console.error(
                `Unable to tear down isolated Compose project ${projectName}: ${redact(String(error))}`,
            );

            try {
                await removeGeneratedContainers();
            } catch (cleanupError) {
                console.error(
                    `Unable to remove remaining containers for isolated Compose project ${projectName}: ${redact(String(cleanupError))}`,
                );
                failure ??= cleanupError;
            }

            failure ??= error;
        }
    }

    try {
        await unlink(envFile);
    } catch {
        // The generated environment may not exist when the engine probe fails.
    }
}

if (failure) {
    process.exitCode = 1;
}
