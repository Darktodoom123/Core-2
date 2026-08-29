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

export function browserFixtures(): BrowserFixtures {
    const path = resolve('storage/framework/testing/browser-fixtures.json');

    return JSON.parse(readFileSync(path, 'utf8')) as BrowserFixtures;
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
    await page.getByLabel('Password').fill(resolvedPass);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/$/);
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
