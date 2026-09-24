import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

type SeededNotification = { id: string };
type SeededHistory = { count: number; oldest_message: string };

const fixtureScript = resolve(import.meta.dirname, 'notification-fixture.php');

function seedNotification(
    username: string,
    category: 'dispatch' | 'safety' | 'fuel' | 'system',
    fixtureId: string,
): string {
    const output = execFileSync(
        'php',
        [fixtureScript, 'seed', username, category, fixtureId],
        { encoding: 'utf8' },
    );

    return (JSON.parse(output.trim()) as SeededNotification).id;
}

function cleanupNotification(username: string, fixtureId: string): void {
    execFileSync(
        'php',
        [fixtureScript, 'cleanup', username, 'dispatch', fixtureId],
        { encoding: 'utf8' },
    );
}

function seedNotificationHistory(
    username: string,
    fixtureId: string,
    count = 125,
): SeededHistory {
    const output = execFileSync(
        'php',
        [
            fixtureScript,
            'seed-history',
            username,
            'system',
            fixtureId,
            String(count),
        ],
        { encoding: 'utf8' },
    );

    return JSON.parse(output.trim()) as SeededHistory;
}

test.describe('notification center E2E workflow', () => {
    test.setTimeout(90_000);

    const fixtureIds: string[] = [];
    let manager: string;

    test.beforeEach(async ({ page }) => {
        const fixtures = browserFixtures();
        manager = fixtures.users.manager;
        fixtureIds.length = 0;
        await signIn(page, manager, fixtures.password);
    });

    test.afterEach(() => {
        for (const fixtureId of fixtureIds) {
            cleanupNotification(manager, fixtureId);
        }
    });

    test('refreshes on open and persists read state from the unread filter', async ({
        page,
    }) => {
        await page.goto('/?view=overview');
        const fixtureId = randomUUID();
        const notificationId = seedNotification(manager, 'dispatch', fixtureId);
        fixtureIds.push(fixtureId);

        await page.getByRole('button', { name: 'Notifications' }).click();

        await expect(
            page.getByText(`E2E dispatch notification ${fixtureId}`, {
                exact: true,
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Notifications, 1 unread' }),
        ).toBeVisible();

        await page.getByRole('button', { name: 'Unread', exact: true }).click();
        await page.getByRole('button', { name: 'Mark read' }).click();
        await expect(page.getByText('No unread notifications')).toBeVisible();
        await expect(
            page.getByRole('button', {
                name: 'Notifications',
                exact: true,
            }),
        ).toBeVisible();

        const response = await page.request.get('/operations/notifications');
        expect(response.ok()).toBeTruthy();
        const payload = (await response.json()) as {
            data: Array<{ id: string; status: string; read_at: string | null }>;
        };
        const persistedNotification = payload.data.find(
            (notification) => notification.id === notificationId,
        );

        expect(persistedNotification?.status).toBe('read');
        expect(persistedNotification?.read_at).not.toBeNull();
    });

    test('marks the clicked safety notification read before opening Safety Governance', async ({
        page,
    }) => {
        await page.goto('/?view=overview');
        const fixtureId = randomUUID();
        const notificationId = seedNotification(manager, 'safety', fixtureId);
        fixtureIds.push(fixtureId);

        await page.getByRole('button', { name: 'Notifications' }).click();
        await expect(
            page.getByText(`E2E safety notification ${fixtureId}`, {
                exact: true,
            }),
        ).toBeVisible();

        await page
            .getByRole('button', { name: /Safety & Inspection Alert/ })
            .click();

        await expect(page).toHaveURL(/view=safety/, { timeout: 45_000 });
        await expect(page.locator('#safety-governance-title')).toBeVisible();

        const response = await page.request.get('/operations/notifications');
        expect(response.ok()).toBeTruthy();
        const payload = (await response.json()) as {
            data: Array<{ id: string; status: string; read_at: string | null }>;
        };
        const persistedNotification = payload.data.find(
            (notification) => notification.id === notificationId,
        );

        expect(persistedNotification?.status).toBe('read');
        expect(persistedNotification?.read_at).not.toBeNull();
    });

    test('marks every unread notification read with one request', async ({
        page,
    }) => {
        const fixtureIdsForTest = [randomUUID(), randomUUID(), randomUUID()];
        const notificationIds = fixtureIdsForTest.map((fixtureId) =>
            seedNotification(manager, 'system', fixtureId),
        );
        fixtureIds.push(...fixtureIdsForTest);

        await page.goto('/?view=overview');
        await page.getByRole('button', { name: 'Notifications' }).click();
        await page
            .getByRole('button', { name: 'View all notifications' })
            .click();
        await expect(page).toHaveURL(/view=notifications/, { timeout: 45_000 });
        await expect(
            page.getByRole('heading', {
                name: 'System & dispatch notifications',
            }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Mark all as read' }),
        ).toBeVisible();
        const markAllResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                new URL(response.url()).pathname ===
                    '/operations/notifications/read-all',
        );
        await page.getByRole('button', { name: 'Mark all as read' }).click();
        expect((await markAllResponse).status()).toBe(302);
        await expect(
            page.getByRole('button', { name: 'Mark all as read' }),
        ).toHaveCount(0);

        const response = await page.request.get('/operations/notifications');
        expect(response.ok()).toBeTruthy();
        const payload = (await response.json()) as {
            data: Array<{ id: string; status: string; read_at: string | null }>;
        };
        const persistedNotifications = notificationIds.map((id) =>
            payload.data.find((notification) => notification.id === id),
        );

        expect(persistedNotifications).toHaveLength(3);
        expect(
            persistedNotifications.every(
                (notification) =>
                    notification?.status === 'read' &&
                    notification.read_at !== null,
            ),
        ).toBeTruthy();
    });

    test('keeps keyboard focus inside the notification dialog until it closes', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/?view=overview');
        const fixtureId = randomUUID();
        seedNotification(manager, 'system', fixtureId);
        fixtureIds.push(fixtureId);

        await page.getByRole('button', { name: 'Notifications' }).click();
        await expect(
            page.getByRole('dialog', { name: 'Notifications' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Close notifications' }),
        ).toBeFocused();

        await page.keyboard.press('Shift+Tab');
        await expect(
            page.getByRole('button', { name: 'View all notifications' }),
        ).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(
            page.getByRole('button', { name: 'Close notifications' }),
        ).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(
            page.getByRole('button', { name: /Notifications/ }),
        ).toBeFocused();
    });

    test('loads notifications older than the first 100', async ({ page }) => {
        const fixtureId = randomUUID();
        const fixture = seedNotificationHistory(manager, fixtureId);
        fixtureIds.push(fixtureId);

        await page.goto('/?view=notifications');
        await expect(
            page.getByRole('heading', {
                name: 'System & dispatch notifications',
            }),
        ).toBeVisible();
        await expect(
            page.getByText(fixture.oldest_message, { exact: true }),
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: 'Load older notifications' }),
        ).toBeVisible();

        await page
            .getByRole('button', { name: 'Load older notifications' })
            .click();

        await expect(
            page.getByText(fixture.oldest_message, { exact: true }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Load older notifications' }),
        ).toHaveCount(0);
    });
});
