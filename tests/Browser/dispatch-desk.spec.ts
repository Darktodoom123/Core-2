import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

const reviewDirectory = resolve('.impeccable/review');
mkdirSync(reviewDirectory, { recursive: true });

test('office dispatch desk preserves schedule context and separates operational views', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await signIn(page);
    await page.goto('/?view=dispatch');
    const views = page.getByRole('navigation', { name: 'Dispatch work views' });
    await expect(
        views.getByRole('button', { name: /^Schedule/ }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(views.getByRole('button')).toHaveCount(4);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    await page.getByLabel('Selected schedule date').fill(date);
    await page.getByLabel('Search loaded dispatches').fill('R6-BROWSER-001');
    await page
        .getByRole('complementary', { name: 'Dispatch list' })
        .getByRole('button', { name: /R6-BROWSER-001/ })
        .click();
    const open = page.getByRole('link', {
        name: 'Review schedule and resources',
        exact: true,
    });
    await expect(open).toBeVisible();
    const target = new URL(
        (await open.getAttribute('href'))!,
        'http://localhost',
    );
    const returnTo = new URL(
        target.searchParams.get('return_to')!,
        'http://localhost',
    );
    expect(returnTo.searchParams.get('dispatch_date')).toBe(date);
    expect(returnTo.searchParams.get('dispatch_q')).toBe('R6-BROWSER-001');
    expect(returnTo.searchParams.get('dispatch_job')).toBe(
        String(browserFixtures().job_id),
    );
    await open.click();
    await expect(
        page.getByRole('heading', { name: /R6-BROWSER-001/ }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Select eligible resources' }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
        path: resolve(reviewDirectory, 'dispatch-preparation-desktop.png'),
        fullPage: true,
        animations: 'disabled',
    });
    await page
        .locator('input[type="checkbox"]:enabled[aria-describedby]')
        .first()
        .check();
    await page.getByRole('button', { name: /Assign 1 resource/i }).click();
    await expect(
        page.getByText(/Resources were assigned to|Assignments were updated/i),
    ).toBeVisible();
    await page
        .getByRole('link', { name: 'Back to dispatch workspace' })
        .click();
    await expect(page.getByLabel('Search loaded dispatches')).toHaveValue(
        'R6-BROWSER-001',
    );
    await expect(page.getByLabel('Selected schedule date')).toHaveValue(date);

    const directory = resolve('.impeccable/review');
    mkdirSync(directory, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
        path: resolve(directory, 'dispatch-desk-desktop.png'),
        fullPage: true,
        animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
        page.getByRole('heading', { name: 'Dispatch desk', exact: true }),
    ).toBeVisible();
    const overflow = await page
        .getByRole('navigation', { name: 'Dispatch work views' })
        .evaluate(
            (element) =>
                element.closest('.workspace-width-contained')!.scrollWidth >
                element.closest('.workspace-width-contained')!.clientWidth + 1,
        );
    expect(overflow, 'dispatch content fits the phone viewport').toBe(false);
    await page.screenshot({
        path: resolve(directory, 'dispatch-desk-mobile.png'),
        fullPage: true,
        animations: 'disabled',
    });
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.screenshot({
        path: resolve(directory, 'dispatch-desk-user-1280.png'),
        fullPage: true,
        animations: 'disabled',
    });
    await page.setViewportSize({ width: 1440, height: 1000 });

    await page
        .getByRole('button', { name: 'Clear filters', exact: true })
        .click();
    await page
        .getByRole('group', { name: 'Schedule display' })
        .getByRole('button', { name: 'Calendar', exact: true })
        .click();
    const periods = page.getByRole('group', { name: 'Schedule period' });

    for (const period of ['week', 'month', 'day']) {
        const button = periods.getByRole('button', {
            name: period,
            exact: true,
        });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
    }

    await views.getByRole('button', { name: /^In progress/ }).click();
    await expect(
        page
            .getByRole('complementary', { name: 'Dispatch list' })
            .getByText('R6-BROWSER-002'),
    ).toBeVisible();
    await views.getByRole('button', { name: /^History/ }).click();
    await expect(
        views.getByRole('button', { name: /^History/ }),
    ).toHaveAttribute('aria-current', 'page');
    await views.getByRole('button', { name: /^Incoming work/ }).click();
    await expect(
        page.getByRole('heading', { name: 'Incoming work queue', exact: true }),
    ).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
        .include('.workspace-width-contained')
        .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(errors).toEqual([]);
});

test('legacy coverage links open operational coverage and restore the selected shift context', async ({
    page,
}) => {
    await signIn(page);
    await page.goto('/?view=dispatch&dispatch_tab=project-plans');
    await expect(
        page.getByRole('heading', { name: 'Resource coverage', exact: true }),
    ).toBeVisible();
    await page.screenshot({
        path: resolve(
            reviewDirectory,
            'dispatch-resource-coverage-desktop.png',
        ),
        fullPage: true,
        animations: 'disabled',
    });
    await expect(
        page.getByRole('button', { name: 'New project plan', exact: true }),
    ).toHaveCount(0);
    await page
        .getByRole('button', { name: /Bridge lifting operations/ })
        .first()
        .click();
    const panel = page.getByRole('dialog');
    await expect(
        panel.getByText('Shift coverage', { exact: true }),
    ).toBeVisible();
    const open = panel
        .getByRole('link', { name: 'Open dispatch', exact: true })
        .first();
    await expect(open).toBeVisible();
    const href = new URL(
        (await open.getAttribute('href'))!,
        'http://localhost',
    );
    const returnTo = href.searchParams.get('return_to')!;
    const coverageDate = await panel
        .getByLabel('Crew week starts')
        .inputValue();
    expect(
        new URL(returnTo, 'http://localhost').searchParams.get('phase'),
    ).toBeTruthy();
    await open.click();
    await expect(
        page.getByRole('link', {
            name: 'Return to resource coverage',
            exact: true,
        }),
    ).toBeVisible();
    await page
        .getByRole('link', { name: 'Return to resource coverage', exact: true })
        .click();
    await expect(
        page.getByRole('dialog').getByText('Shift coverage', { exact: true }),
    ).toBeVisible();

    // A shift opened from the ordinary desk still needs a distinct coverage route.
    const jobId = href.pathname.split('/').at(-1)!;
    await page.goto(
        `/?view=dispatch&dispatch_view=schedule&dispatch_mode=list&dispatch_date=${coverageDate}&dispatch_job=${jobId}`,
    );
    await page.locator(`a[href^="${href.pathname}?"]`).first().click();
    const coverageLink = page.getByRole('link', {
        name: 'Return to resource coverage',
        exact: true,
    });
    const coverageTarget = new URL(
        (await coverageLink.getAttribute('href'))!,
        'http://localhost',
    );
    expect(
        coverageTarget.searchParams.get('dispatch_tab') === 'project-plans' ||
            coverageTarget.searchParams.get('dispatch_mode') === 'resources',
    ).toBe(true);
    await coverageLink.click();
    await expect(
        page.getByRole('dialog').getByText('Shift coverage', { exact: true }),
    ).toBeVisible();
});

test('field operators retain their assigned-work workspace', async ({
    page,
}) => {
    const fixtures = browserFixtures();
    await signIn(page, fixtures.users.operator);
    await page.goto('/?view=dispatch');
    await expect(
        page.getByRole('heading', {
            name: "Today's assigned work",
            exact: true,
        }),
    ).toBeVisible();
    await expect(
        page.getByRole('navigation', { name: 'Dispatch work views' }),
    ).toHaveCount(0);
});
