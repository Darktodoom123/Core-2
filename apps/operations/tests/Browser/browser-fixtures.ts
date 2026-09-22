import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

export type BrowserFixtures = {
    users: {
        admin?: string;
        manager: string;
        operator?: string;
        dispatcher?: string;
        driver?: string;
        safety_officer?: string;
        foreman?: string;
    };
    password: string;
    job_id: number;
    assignment_review_job_id: number;
    assigned_job_id: number;
    approval_job_id?: number;
    approval_request_id?: number;
    lifecycle_job_id?: number;
    truck_id?: number;
    crane_id?: number;
    report_id: number;
    attachment_id: number;
    export_ids: string[];
    recommendations: Record<string, number>;
    sos_incident_id?: string;
    lift_plan_id?: number;
    tbm_id?: number;
    hazard_id?: number;
};

export function resolveBrowserFixturePath(): string {
    const fixturePath = resolve(
        import.meta.dirname,
        '../../storage/framework/testing/browser-fixtures.json',
    );

    return fixturePath;
}

export function browserFixtures(): BrowserFixtures {
    const path = resolveBrowserFixturePath();

    return JSON.parse(readFileSync(path, 'utf8')) as BrowserFixtures;
}

export interface ActiveOtpDetails {
    code: string;
    challenge_id: string;
    attempts: number;
    resend_count: number;
    expires_at: string;
}

export function getLatestOtp(identifier = 'browser.manager'): ActiveOtpDetails {
    const helperScript = resolve(import.meta.dirname, 'otp-helper.php');
    const output = execFileSync('php', [helperScript, 'get', identifier], {
        encoding: 'utf8',
    });

    return JSON.parse(output.trim()) as ActiveOtpDetails;
}

export function clearOtpCooldown(identifier = 'browser.manager'): void {
    const helperScript = resolve(import.meta.dirname, 'otp-helper.php');
    execFileSync('php', [helperScript, 'clear-cooldown', identifier], {
        encoding: 'utf8',
    });
}

export function resetTestUser(identifier = 'browser.manager'): void {
    const helperScript = resolve(import.meta.dirname, 'otp-helper.php');
    execFileSync('php', [helperScript, 'reset-user', identifier], {
        encoding: 'utf8',
    });
}

export function countTrustedDevices(identifier = 'browser.manager'): number {
    const helperScript = resolve(import.meta.dirname, 'otp-helper.php');
    const output = execFileSync(
        'php',
        [helperScript, 'count-trusted-devices', identifier],
        {
            encoding: 'utf8',
        },
    );
    const parsed = JSON.parse(output.trim()) as { count: number };

    return parsed.count;
}

export async function signIn(page: Page, username?: string, password?: string) {
    const fixtures = browserFixtures();
    const resolvedUser =
        username ||
        fixtures.users.manager ||
        fixtures.users.dispatcher ||
        'manager';
    const resolvedPass = password || fixtures.password || 'password';

    await page.goto('/login');
    await page.getByLabel('Username').fill(resolvedUser);
    await page.getByRole('textbox', { name: 'Password' }).fill(resolvedPass);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await page.waitForURL(
        (url) => url.pathname === '/' || url.pathname === '/login/challenge',
    );

    if (page.url().includes('/login/challenge')) {
        const otp = getLatestOtp(resolvedUser);
        const trustCheckbox = page.getByLabel(/Trust this device for 30 days/i);

        if (await trustCheckbox.isVisible()) {
            await trustCheckbox.check();
        }

        await page.getByPlaceholder('000000').fill(otp.code);
        await page.getByRole('button', { name: 'Verify and sign in' }).click();
        await page.waitForURL(/\/$/);
    }
}

export async function browserFetch(
    page: Page,
    url: string,
): Promise<{
    status: number;
    contentType: string;
    disposition: string;
    body: string;
}> {
    return page.evaluate(async (requestUrl) => {
        const response = await fetch(requestUrl);

        return {
            status: response.status,
            contentType: response.headers.get('content-type') ?? '',
            disposition: response.headers.get('content-disposition') ?? '',
            body: await response.text(),
        };
    }, url);
}
