import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Dialog, Locator, Page } from '@playwright/test';
import { browserFixtures, signIn } from './browser-fixtures';

const browserFixturePath = resolve(
    'storage/framework/testing/browser-fixtures.json',
);

type RuntimeErrors = {
    console: string[];
    page: string[];
};

const runtimeErrors = new WeakMap<Page, RuntimeErrors>();

function captureRuntimeErrors(page: Page): RuntimeErrors {
    const errors: RuntimeErrors = { console: [], page: [] };

    page.on('console', (message) => {
        if (message.type() === 'error') {
            const text = message.text();

            if (
                text.includes('WebSocket connection to') ||
                text.includes('net::ERR_CONNECTION_REFUSED') ||
                text.includes('net::ERR_NO_BUFFER_SPACE')
            ) {
                return;
            }

            errors.console.push(text);
        }
    });
    page.on('pageerror', (error) => {
        errors.page.push(error.message);
    });

    runtimeErrors.set(page, errors);

    return errors;
}

async function goToDispatch(page: Page) {
    await page.goto('/?view=dispatch');
    await expect(
        page.getByRole('button', { name: /^New dispatch\b/i }),
    ).toBeVisible();
}

async function directDispatchView(page: Page): Promise<Locator> {
    const heading = page
        .getByRole('heading', { name: /Direct dispatch/i })
        .last();

    await expect(heading).toBeVisible();

    for (const selector of [
        '[data-testid="direct-dispatch-subview"]',
        '#direct-dispatch-subview',
        '[role="region"][aria-label*="Direct dispatch" i]',
        'section[aria-labelledby]',
    ]) {
        const candidate = page.locator(selector).filter({ has: heading });

        if ((await candidate.count()) > 0) {
            return candidate.first();
        }
    }

    return heading.locator('xpath=ancestor::section[1]');
}

async function openDirectDispatch(page: Page): Promise<Locator> {
    await goToDispatch(page);

    const newDispatch = page.getByRole('button', {
        name: /^New dispatch\b/i,
    });
    await newDispatch.click();

    const createDirect = page.getByRole('button', {
        name: /^Create direct dispatch$/i,
    });
    await expect(createDirect).toBeVisible();
    await createDirect.click();

    return directDispatchView(page);
}

function discardDialog(page: Page): Locator {
    return page
        .locator('[role="dialog"], [role="alertdialog"]')
        .filter({ hasText: /discard|unsaved/i })
        .first();
}

async function triggerAndDiscard(page: Page, trigger: () => Promise<void>) {
    let nativeDialogType = '';
    const handleNativeDialog = async (dialog: Dialog) => {
        nativeDialogType = dialog.type();
        await dialog.accept();
    };

    page.once('dialog', handleNativeDialog);
    await trigger();

    const accessibleDialog = discardDialog(page);

    if ((await accessibleDialog.count()) > 0) {
        page.off('dialog', handleNativeDialog);
        await expect(accessibleDialog).toBeVisible();
        await accessibleDialog
            .getByRole('button', { name: /Discard/i })
            .click();
    } else {
        await expect.poll(() => nativeDialogType).toBe('confirm');
    }

    await expect(
        page.getByRole('heading', { name: /Direct dispatch/i }),
    ).toBeHidden();
}

async function fillDirtyDraft(direct: Locator) {
    const firstTextField = direct.getByRole('textbox').first();
    await expect(firstTextField).toBeVisible();
    await firstTextField.fill('Draft to discard');
}

async function focusedAccessibleName(page: Page): Promise<string> {
    return page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;

        return (
            element?.getAttribute('aria-label') ??
            element?.getAttribute('name') ??
            element?.textContent?.trim() ??
            ''
        );
    });
}

async function hasStickyAncestor(locator: Locator): Promise<boolean> {
    return locator.evaluate((element) => {
        let current: HTMLElement | null = element;

        while (current) {
            if (getComputedStyle(current).position === 'sticky') {
                return true;
            }

            current = current.parentElement;
        }

        return false;
    });
}

function countFromText(text: string): number {
    const match = text.match(/\b(\d+)\b/);

    return match ? Number(match[1]) : 0;
}

async function requirementSummary(direct: Locator): Promise<Locator> {
    const summary = direct.getByRole('complementary', {
        name: /Direct dispatch summary/i,
    });
    const label = summary.getByText(/^Requirements$/i);

    await expect(label).toBeVisible();

    return label.locator('xpath=..');
}

test.describe('New dispatch direct-intake contract', () => {
    test.beforeEach(async ({ page }) => {
        // The repository's browser web server creates this fixture during the
        // full acceptance setup. Skip locally when that setup is unavailable.
        if (!existsSync(browserFixturePath)) {
            test.skip(true, 'browser-fixtures.json is not available');

            return;
        }

        captureRuntimeErrors(page);

        const fixtures = browserFixtures();
        await signIn(page, fixtures.users.manager, fixtures.password);
    });

    test.afterEach(async ({ page }) => {
        const errors = runtimeErrors.get(page);

        if (!errors) {
            return;
        }

        expect(errors.console, 'browser console errors').toEqual([]);
        expect(errors.page, 'uncaught page errors').toEqual([]);
    });

    test('replaces intake with the dedicated direct subview and uses rendered counts/provenance', async ({
        page,
    }) => {
        await goToDispatch(page);

        await page.getByRole('button', { name: /^New dispatch\b/i }).click();

        const queueHeading = page.getByRole('heading', {
            name: 'Incoming work queue',
            exact: true,
        });
        const fallbackLabel = page.getByText('Direct operational fallback', {
            exact: true,
        });
        const reconciliationLabel = page.getByText('Dispatch review', {
            exact: true,
        });
        const reconciliationButton = page.getByRole('button', {
            name: /Review unmatched handoffs/i,
        });
        const headerAddClient = page.getByRole('button', {
            name: 'Add client',
            exact: true,
        });

        await expect(queueHeading).toBeVisible();
        await expect(fallbackLabel).toBeVisible();
        await expect(reconciliationLabel).toBeVisible();
        await expect(headerAddClient).toBeVisible();

        const queue = page.getByRole('list', { name: 'Incoming work queue' });
        const renderedIncomingRows = queue.getByRole('listitem');
        const renderedIncomingCount = await renderedIncomingRows.count();
        const queueBadge = page
            .getByText(/\d+ needs review|No handoffs waiting/i)
            .first();
        const queueBadgeText = await queueBadge.innerText();

        if (renderedIncomingCount === 0) {
            expect(queueBadgeText).toMatch(/No handoffs waiting/i);
        } else {
            expect(countFromText(queueBadgeText)).toBe(renderedIncomingCount);
        }

        const reconciliationButtonText = await reconciliationButton.innerText();
        await reconciliationButton.click();
        await expect(
            page.getByRole('heading', {
                name: /reconciliation queue/i,
            }),
        ).toBeVisible();
        const renderedReconciliationRows = page.getByRole('button', {
            name: /Convert to linked dispatch/i,
        });
        const renderedReconciliationCount =
            await renderedReconciliationRows.count();
        expect(countFromText(reconciliationButtonText)).toBe(
            renderedReconciliationCount,
        );
        await page
            .getByRole('button', { name: /Close reconciliation queue/i })
            .click();
        await expect(queueHeading).toBeVisible();

        const direct = await openDirectDispatch(page);

        // Parent integration contract: this is a subview replacement, not an
        // appended form below the queue/fallback/reconciliation rows.
        await expect(queueHeading).toBeHidden();
        await expect(fallbackLabel).toBeHidden();
        await expect(reconciliationLabel).toBeHidden();
        await expect(headerAddClient).toBeHidden();
        await expect(page.getByRole('dialog')).toHaveCount(0);

        await expect(
            direct.getByText('Manual source · manual_intake', {
                exact: true,
            }),
        ).toBeVisible();
        const formSequence = [
            'Work type',
            'Dispatch details',
            'Requirements to include in the job brief',
            'Optional custom requirements and site notes',
        ];
        const formHeadingPositions = await Promise.all(
            formSequence.map(async (name) =>
                direct
                    .getByRole('heading', { name, exact: true })
                    .boundingBox(),
            ),
        );
        const formHeadingY = formHeadingPositions.map(
            (position) => position?.y ?? Number.NaN,
        );
        expect(formHeadingY.every(Number.isFinite)).toBe(true);
        expect(formHeadingY).toEqual(
            [...formHeadingY].sort((left, right) => left - right),
        );
        await expect(
            direct.getByText(/Reference prefix DSP-(SRV|REN|SAL|MAN)/i),
        ).toBeVisible();
        await expect(direct).toContainText(/future job[- ]brief/i);
        await expect(direct).toContainText(
            /not completed inspections|inspection is complete/i,
        );

        const checkedRequirements = await direct
            .locator('input[type="checkbox"]:checked')
            .count();
        expect(checkedRequirements).toBeGreaterThan(0);
        await expect(await requirementSummary(direct)).toContainText(
            String(checkedRequirements),
        );

        const summary = direct
            .getByRole('complementary', { name: /Dispatch summary/i })
            .or(
                direct
                    .getByText(
                        'Draft only — assignment and activation happen later.',
                        { exact: true },
                    )
                    .locator('xpath=ancestor::aside[1]'),
            )
            .first();

        await expect(summary).toBeVisible();
        await expect(summary).toContainText(/Client/i);
        await expect(summary).toContainText(/Stream|subtype/i);
        await expect(summary).toContainText(/Site/i);
        await expect(summary).toContainText(/Schedule/i);
        await expect(summary).toContainText(/Priority/i);
        await expect(summary).toContainText(/Requirements?|Requirement count/i);
        await expect(summary).toContainText(/Missing required fields/i);
        await expect(summary).toContainText(/Provenance/i);
        await expect(summary).toContainText(
            'Draft only — assignment and activation happen later.',
        );

        await expect(
            direct.getByRole('button', { name: /Back to intake/i }),
        ).toHaveCount(1);
        await expect(
            direct.getByRole('button', { name: /Close|Cancel/i }),
        ).toHaveCount(0);
        const globalClose = page.locator('#new-dispatch-trigger');
        await expect(globalClose).toHaveCount(1);
        await expect(globalClose).toHaveAccessibleName(/Close new dispatch/i);
    });

    test('focuses entry, keeps the draft beside the client control, and restores trigger focus on exit', async ({
        page,
    }) => {
        await goToDispatch(page);

        const newDispatch = page.getByRole('button', {
            name: /^New dispatch\b/i,
        });
        await newDispatch.click();

        const createDirect = page.getByRole('button', {
            name: /^Create direct dispatch$/i,
        });
        await createDirect.click();

        const direct = await directDispatchView(page);
        const heading = page
            .getByRole('heading', { name: /Direct dispatch/i })
            .last();
        await expect(heading).toBeFocused();

        const clientControl = direct
            .getByRole('combobox', { name: /Client/i })
            .or(direct.getByLabel(/^Client/i))
            .first();
        await expect(clientControl).toBeVisible();
        await clientControl.fill('Draft client that must survive Add client');

        // Parent integration contract: Add Client moved beside the client
        // control and does not replace/reset the direct-dispatch draft.
        const addClient = direct
            .getByRole('button', {
                name: /Client not found\? Add client/i,
            })
            .or(
                direct.getByRole('link', {
                    name: /Client not found\? Add client/i,
                }),
            )
            .first();
        await expect(addClient).toBeVisible();
        await addClient.click();
        await expect(clientControl).toHaveValue(
            'Draft client that must survive Add client',
        );

        await triggerAndDiscard(page, () =>
            direct.getByRole('button', { name: /Back to intake/i }).click(),
        );
        await expect
            .poll(() => focusedAccessibleName(page))
            .toMatch(/Create direct dispatch|New dispatch/i);
    });

    test('protects dirty drafts across back, close, Escape, and browser unload', async ({
        page,
    }) => {
        const flows: Array<{
            name: string;
            invoke: (direct: Locator, page: Page) => Promise<void>;
        }> = [
            {
                name: 'Back to intake',
                invoke: async (direct) => {
                    await direct
                        .getByRole('button', {
                            name: /Back to intake/i,
                        })
                        .click();
                },
            },
            {
                name: 'global close',
                invoke: async (_direct, currentPage) => {
                    await currentPage.locator('#new-dispatch-trigger').click();
                },
            },
            {
                name: 'Escape',
                invoke: async (_direct, currentPage) => {
                    await currentPage.keyboard.press('Escape');
                },
            },
        ];

        for (const flow of flows) {
            await test.step(flow.name, async () => {
                const direct = await openDirectDispatch(page);
                await fillDirtyDraft(direct);
                await triggerAndDiscard(page, () => flow.invoke(direct, page));
                await expect
                    .poll(() => focusedAccessibleName(page))
                    .toMatch(/Create direct dispatch|New dispatch/i);
            });
        }

        const direct = await openDirectDispatch(page);
        await fillDirtyDraft(direct);

        let unloadDialogType = '';
        const handleUnloadDialog = (dialog: Dialog) => {
            unloadDialogType = dialog.type();
            void dialog.accept();
        };
        page.once('dialog', handleUnloadDialog);
        await page.reload({ waitUntil: 'domcontentloaded' });
        page.off('dialog', handleUnloadDialog);

        // Parent integration contract: the browser unload guard is the final
        // safety net for a dirty direct-dispatch draft.
        expect(unloadDialogType).toBe('beforeunload');
    });

    test('reports missing fields, focuses the first error, and wires stable error descriptions', async ({
        page,
    }) => {
        const direct = await openDirectDispatch(page);
        const missingSummary = direct.getByText(/Missing required fields/i);
        const createDraft = direct.getByRole('button', {
            name: /Create draft dispatch/i,
        });

        await expect(missingSummary).toBeVisible();
        await expect(createDraft).toBeEnabled();
        await createDraft.click();

        const firstInvalid = direct.locator('[aria-invalid="true"]').first();
        await expect(firstInvalid).toBeFocused();
        const describedBy = await firstInvalid.getAttribute('aria-describedby');
        expect(describedBy).toBeTruthy();

        for (const errorId of describedBy?.split(/\s+/) ?? []) {
            await expect(direct.locator(`#${errorId}`)).toBeVisible();
        }
    });

    test('keeps requirement checkboxes visibly focusable and all visible targets at least 44px', async ({
        page,
    }) => {
        const direct = await openDirectDispatch(page);
        const checkbox = direct.getByRole('checkbox').first();
        await expect(checkbox).toBeVisible();

        const focusBefore = await checkbox.evaluate((element) => {
            const label = element.closest('label');

            if (!label) {
                return null;
            }

            const style = getComputedStyle(label);

            return {
                className: label.className,
                outline: style.outline,
                boxShadow: style.boxShadow,
                borderColor: style.borderColor,
            };
        });

        await checkbox.focus();
        await expect(checkbox).toBeFocused();

        const focusAfter = await checkbox.evaluate((element) => {
            const label = element.closest('label');

            if (!label) {
                return null;
            }

            const style = getComputedStyle(label);

            return {
                className: label.className,
                outline: style.outline,
                boxShadow: style.boxShadow,
                borderColor: style.borderColor,
            };
        });

        expect(focusAfter).not.toBeNull();
        expect(
            focusAfter?.className.includes('focus-within') ||
                focusAfter?.outline !== focusBefore?.outline ||
                focusAfter?.boxShadow !== focusBefore?.boxShadow ||
                focusAfter?.borderColor !== focusBefore?.borderColor,
        ).toBe(true);

        const undersizedTargets = await direct
            .locator(
                'button, a[href], input:not([type="checkbox"]):not([type="hidden"]), select, textarea',
            )
            .evaluateAll((elements) =>
                elements.flatMap((element) => {
                    const style = getComputedStyle(element);
                    const box = element.getBoundingClientRect();

                    if (
                        style.display === 'none' ||
                        style.visibility === 'hidden' ||
                        box.width === 0 ||
                        box.height === 0
                    ) {
                        return [];
                    }

                    return box.width < 44 || box.height < 44
                        ? [
                              `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}: ${Math.round(box.width)}x${Math.round(box.height)}`,
                          ]
                        : [];
                }),
            );

        expect(undersizedTargets).toEqual([]);
    });

    test('reflows at 320/640 and 390/844 and keeps sticky actions safe', async ({
        page,
    }) => {
        for (const [width, height] of [
            [320, 640],
            [390, 844],
        ] as const) {
            await test.step(`${width}x${height}`, async () => {
                await page.setViewportSize({ width, height });
                const direct = await openDirectDispatch(page);

                const documentWidth = await page.evaluate(
                    () => document.documentElement.scrollWidth,
                );
                expect(documentWidth).toBeLessThanOrEqual(width + 30);

                await expect(
                    direct.getByText(
                        'Draft only — assignment and activation happen later.',
                        { exact: true },
                    ),
                ).toBeVisible();

                const createDraft = direct.getByRole('button', {
                    name: /Create draft dispatch/i,
                });
                await expect(createDraft).toBeVisible();
                expect(await hasStickyAncestor(createDraft)).toBe(true);
            });
        }

        await page.setViewportSize({ width: 1280, height: 844 });
        const desktopDirect = await openDirectDispatch(page);
        const summary = desktopDirect.getByRole('complementary', {
            name: /Dispatch summary/i,
        });
        await expect(summary).toBeVisible();
        expect(await hasStickyAncestor(summary)).toBe(true);
    });

    test('preserves semantic feedback under reduced motion and passes Axe with contrast enabled', async ({
        page,
    }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const direct = await openDirectDispatch(page);

        const summary = await requirementSummary(direct);
        const before = await summary.innerText();
        const checkbox = direct.getByRole('checkbox').first();
        await checkbox.check({ force: true });
        await expect(summary).not.toHaveText(before);

        const reducedMotionKillSwitches = await direct.evaluate(
            (root) =>
                Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
                    (element) => {
                        const style = getComputedStyle(element);

                        return (
                            style.animationDuration === '0.001s' ||
                            style.transitionDuration === '0.001s'
                        );
                    },
                ).length,
        );
        expect(reducedMotionKillSwitches).toBe(0);

        // Color contrast remains enabled intentionally; do not disable the
        // color-contrast rule for this dispatch-intake audit.
        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag21aa', 'wcag22aa'])
            .analyze();
        expect(results.violations).toEqual([]);
    });
});
