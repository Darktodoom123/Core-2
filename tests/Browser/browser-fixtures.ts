import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';

export type BrowserFixtures = {
    users: { dispatcher: string; manager: string; driver: string };
    password: string;
    job_id: number;
    assigned_job_id: number;
    report_id: number;
    attachment_id: number;
    export_ids: string[];
    recommendations: Record<string, number>;
};

export function browserFixtures(): BrowserFixtures {
    const path = resolve('storage/framework/testing/browser-fixtures.json');

    return JSON.parse(readFileSync(path, 'utf8')) as BrowserFixtures;
}

export async function signIn(page: Page, username: string, password: string) {
    await page.goto('/login');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(password);
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
