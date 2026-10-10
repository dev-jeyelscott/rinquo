import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { readCode } from './support/sign-in';

/**
 * Spec 03 customer booking management against the running stack: a customer
 * books, then reschedules through the server-authored times (select, review,
 * confirm), reschedules a second time from the replacement page, and reviews a
 * cancellation. Runs at the approved 1600x1000 and 390x844 viewports and
 * asserts that no buffer, capacity or resource wording reaches the customer and
 * that the page never scrolls sideways. Like the booking journey it needs the
 * APP_ENV=testing fixtures (compose.ci.yaml) and skips without them.
 */

type Seed = { slug: string };

const MAKE_MODEL = 'Toyota Vios';
const INTERNALS = /buffer|capacity|\bunits?\b|\bbay\b|resource/i;
const TIME = /^\d{1,2}:\d{2}\s?[AP]M$/;

async function seedShop(request: APIRequestContext): Promise<Seed> {
    const slug = `e2e-manage-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await request.post('/__testing/shop', {
        data: { slug, capacity: 3, approval_mode: 'auto_confirm' },
    });
    expect(response.ok()).toBe(true);

    return (await response.json()) as Seed;
}

/** Books a time two days out as a verified customer and lands on the confirmed booking page. */
async function bookConfirmed(page: Page, slug: string) {
    await page.goto(`/shops/${slug}`);
    await page.getByRole('link', { name: 'Book now' }).click();
    await page.locator('label').filter({ hasText: 'Sedan' }).click();
    await page.getByLabel(/^Make \/ model/).fill(MAKE_MODEL);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.locator('label').filter({ hasText: 'Full wash' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    // A time two days out stays well clear of the change deadline, so management is offered.
    await page
        .getByRole('radiogroup', { name: 'Date' })
        .getByRole('radio')
        .nth(2)
        .click();
    // The day's times load after the date change; a time chosen before they settle is dropped, so retry until it holds.
    await expect(async () => {
        const time = page.getByRole('radio', { name: TIME }).first();
        await time.click();
        await expect(time).toBeChecked({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await page
        .getByRole('button', { name: 'Hold this time & continue' })
        .click();

    const email = `manage-${Date.now()}@example.test`;
    await page.getByLabel(/^Full name/).fill('Ana Cruz');
    await page.getByLabel(/^Email address/).fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();
    await page.getByLabel('Digit 1 of 6').click();
    await page.keyboard.type(await readCode(page, email));
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(
        page.getByRole('heading', { level: 2, name: 'Booking confirmed' }),
    ).toBeVisible();
}

/** Chooses the last enabled time of the open day, reviews it and confirms. Returns the chosen label. */
async function rescheduleToLastTime(page: Page): Promise<string> {
    const enabled = page.getByRole('radio', { name: TIME });
    const label = ((await enabled.last().textContent()) ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    await enabled.last().click();
    await page.getByRole('button', { name: /Review new time/ }).click();
    await expect(
        page.getByRole('heading', { name: 'Review your new appointment' }),
    ).toBeFocused();
    await expect(page.getByText('Current appointment')).toBeVisible();
    await expect(page.getByText('Requested replacement')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm new time' }).click();

    return label;
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get('/__testing/otp?email=probe@example.test');
    test.skip(
        probe.status() === 404,
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the booking management journey.',
    );
});

for (const viewport of [
    { name: 'desktop 1600x1000', width: 1600, height: 1000 },
    { name: 'mobile 390x844', width: 390, height: 844 },
]) {
    test.describe(`approved ${viewport.name}`, () => {
        test.use({
            viewport: { width: viewport.width, height: viewport.height },
        });

        test('reschedules twice through server-offered times and never exposes internals', async ({
            page,
        }) => {
            test.setTimeout(180_000);
            const seed = await seedShop(page.request);
            await bookConfirmed(page, seed.slug);
            const sourceUrl = page.url();

            // The approved result stays on top; management is a choice below it, with the summary beside it.
            await expect(page.locator('main')).not.toContainText(INTERNALS);
            await expect(
                page.getByRole('heading', { name: 'Manage your appointment' }),
            ).toBeVisible();
            await expect(page.getByText('Stay informed')).toBeVisible();
            await expect(
                page.getByRole('region', { name: 'Your booking' }),
            ).toContainText('Confirmed');
            await page
                .getByRole('button', { name: 'Choose another time' })
                .click();
            await expect(
                page.getByRole('navigation', { name: 'Reschedule steps' }),
            ).toContainText('Review change');
            // Choosing alone changes nothing: Review stays disabled until a time is chosen.
            await expect(
                page.getByRole('button', { name: /Review new time/ }),
            ).toHaveAttribute('aria-disabled', 'true');

            await rescheduleToLastTime(page);
            await expect(page).not.toHaveURL(sourceUrl);
            // The new result is announced: its heading, not a reschedule step heading, holds focus.
            await expect(
                page.getByRole('heading', {
                    level: 2,
                    name: 'Booking confirmed',
                }),
            ).toBeFocused();
            await expect(page.getByText(/Moved from/)).toBeVisible();
            await expect(
                page.getByText(`Sedan · ${MAKE_MODEL}`).first(),
            ).toBeVisible();
            const replacementUrl = page.url();

            // The original is now a durable record pointing at its replacement.
            await page.goto(sourceUrl);
            await expect(
                page.getByRole('heading', {
                    level: 2,
                    name: 'Booking rescheduled',
                }),
            ).toBeVisible();
            await expect(
                page.getByRole('link', { name: 'View your new booking' }),
            ).toBeVisible();

            // A second reschedule from the replacement is a new request and succeeds.
            await page.goto(replacementUrl);
            await page
                .getByRole('button', { name: 'Choose another time' })
                .click();
            await page.getByRole('radio', { name: TIME }).first().click();
            await page.getByRole('button', { name: /Review new time/ }).click();
            await page
                .getByRole('button', { name: 'Confirm new time' })
                .click();
            await expect(page).not.toHaveURL(replacementUrl);
            await expect(
                page.getByRole('heading', {
                    level: 2,
                    name: 'Booking confirmed',
                }),
            ).toBeVisible();
            await expect(page.locator('main')).not.toContainText(INTERNALS);
            expect(
                await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth <=
                        document.documentElement.clientWidth,
                ),
            ).toBe(true);
        });

        test('reviews a cancellation in a dialog and returns focus on dismiss', async ({
            page,
        }) => {
            test.setTimeout(180_000);
            const seed = await seedShop(page.request);
            await bookConfirmed(page, seed.slug);

            await page.getByRole('button', { name: 'Cancel booking' }).click();
            await expect(
                page.getByRole('heading', { name: 'Cancel this booking?' }),
            ).toBeFocused();
            const trigger = page.getByRole('button', {
                name: 'Review cancellation',
            });
            await trigger.click();
            const dialog = page.getByRole('dialog', {
                name: 'Cancel this booking?',
            });
            await expect(dialog).toContainText(
                'Your booking stays as it is until then',
            );
            const keep = dialog.getByRole('button', { name: 'Keep booking' });
            if (viewport.width < 640) {
                // The dialog zooms in; measure once it settles.
                await expect
                    .poll(async () => (await keep.boundingBox())?.height)
                    .toBeGreaterThanOrEqual(44);
                const close = dialog.getByRole('button', { name: 'Close' });
                await expect
                    .poll(async () => (await close.boundingBox())?.height)
                    .toBeGreaterThanOrEqual(44);
            }
            await keep.click();
            await expect(trigger).toBeFocused();

            await trigger.click();
            await dialog
                .getByRole('button', { name: 'Cancel booking' })
                .click();
            await expect(
                page.getByRole('heading', {
                    level: 2,
                    name: 'Booking cancelled',
                }),
            ).toBeFocused();
            await expect(
                page.getByRole('region', { name: 'Appointment history' }),
            ).toContainText('Cancelled');
            await expect(
                page.getByRole('button', { name: 'Cancel booking' }),
            ).toHaveCount(0);
        });
    });
}
