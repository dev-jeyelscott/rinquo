import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Customer journey against the running stack, signed out: open a published
 * shop, choose a vehicle, enter its make and model, choose a service and add-on,
 * pick the next available time, enter details, verify the emailed six-digit
 * code, confirm and see the booking. A second browser then finds that time
 * disabled, and a double click on Confirm makes exactly one booking. The Spec 02
 * checks repeat the journey at the approved 390x844 and 1600x1000 viewports and
 * assert the fixed mobile action bar, the desktop side summary, the make/model
 * snapshot and that no buffer, capacity or resource wording reaches the customer.
 *
 * Both the shop (an around-the-clock fixture) and the emailed code come from
 * routes that exist only when the app runs with APP_ENV=testing (the CI compose
 * override does this; see compose.ci.yaml). The tests skip with a clear message
 * when they are absent.
 */

type Seed = {
    slug: string;
    vehicleId: number;
    serviceId: number;
    addOnId: number;
};

const TIME = /^\d{1,2}:\d{2}\s?[AP]M$/;
const MAKE_MODEL = 'Toyota Vios';
const INTERNALS = /buffer|capacity|\bunits?\b|\bbay\b|resource/i;

async function seedShop(
    request: APIRequestContext,
    options: {
        capacity?: number;
        approvalMode?: 'auto_confirm' | 'staff_approval';
    } = {},
): Promise<Seed> {
    const slug = `e2e-book-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await request.post('/__testing/shop', {
        data: {
            slug,
            capacity: options.capacity ?? 1,
            approval_mode: options.approvalMode ?? 'auto_confirm',
        },
    });
    expect(response.ok()).toBe(true);

    return (await response.json()) as Seed;
}

async function readCode(page: Page, email: string): Promise<string> {
    let code: string | null = null;

    await expect
        .poll(
            async () => {
                const response = await page.request.get(
                    `/__testing/otp?email=${encodeURIComponent(email)}`,
                );
                code = response.ok()
                    ? ((await response.json()) as { code: string | null }).code
                    : null;

                return code;
            },
            { timeout: 15_000 },
        )
        .not.toBeNull();

    return code as unknown as string;
}

async function bookingCount(page: Page, slug: string): Promise<number> {
    const response = await page.request.get(`/__testing/bookings?slug=${slug}`);

    return ((await response.json()) as { count: number }).count;
}

/** Walks the wizard to the Details step. Returns the wizard URL (carries the selection) and the chosen time label. */
async function holdNextAvailable(page: Page, slug: string) {
    await page.goto(`/shops/${slug}`);
    await page.getByRole('link', { name: 'Book now' }).click();

    await page.locator('label').filter({ hasText: 'Sedan' }).click();
    // The make and model is required: Continue stays disabled without it.
    await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await page.getByLabel(/^Make \/ model/).fill(MAKE_MODEL);
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('label').filter({ hasText: 'Full wash' }).click();
    await page.locator('label').filter({ hasText: 'Wax' }).click();
    await expect(
        page.getByRole('complementary', { name: 'Booking summary' }),
    ).toContainText('₱500');
    await expect(page.locator('body')).not.toContainText(INTERNALS);
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: 'Next available' }).click();
    const chosen = page.getByRole('radio', { name: TIME, checked: true });
    await expect(chosen).toBeVisible();
    const label = ((await chosen.textContent()) ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const wizardUrl = page.url();

    await page
        .getByRole('button', { name: 'Hold this time & continue' })
        .click();
    await expect(
        page.getByRole('heading', { name: 'Who is this booking for?' }),
    ).toBeVisible();
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByLabel(/^Vehicle make \/ model/)).toHaveValue(
        MAKE_MODEL,
    );

    return { wizardUrl, label };
}

/** The make and model never travel in the URL: a reload or deep link resumes at Vehicle instead of dead-ending at the hold. */
async function resumeSchedule(page: Page) {
    await expect(
        page.getByRole('heading', { name: 'What are you bringing in?' }),
    ).toBeVisible();
    await page.getByLabel(/^Make \/ model/).fill(MAKE_MODEL);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
}

async function verifyEmail(page: Page, email: string) {
    await page.getByLabel(/^Full name/).fill('Ana Cruz');
    await page.getByLabel(/^Email address/).fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();

    // Six separate digit cells: typing advances from cell to cell.
    await page.getByLabel('Digit 1 of 6').click();
    await page.keyboard.type(await readCode(page, email));
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(
        page.getByRole('heading', { name: 'Review and confirm' }),
    ).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get('/__testing/otp?email=probe@example.test');
    test.skip(
        probe.status() === 404,
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the customer journey.',
    );
});

test('a signed-out customer books the next available time and a second visitor cannot take it', async ({
    page,
    browser,
}) => {
    test.setTimeout(120_000);
    const seed = await seedShop(page.request, { capacity: 1 });
    const email = `customer-${Date.now()}@example.test`;

    const { wizardUrl, label } = await holdNextAvailable(page, seed.slug);

    // While the first customer holds the last unit, a second browser sees that time disabled.
    const visitor = await browser.newContext();
    const other = await visitor.newPage();
    await other.goto(wizardUrl);
    await resumeSchedule(other);
    await expect(
        other.getByRole('radio', { name: `${label}, unavailable` }),
    ).toBeDisabled();

    await verifyEmail(page, email);
    await page.getByRole('button', { name: 'Confirm booking' }).click();

    await expect(
        page.getByRole('heading', { level: 2, name: 'Booking confirmed' }),
    ).toBeVisible();
    await expect(page.getByText('Full wash + Wax')).toBeVisible();
    // The make and model is a booking snapshot shown with the vehicle type.
    await expect(page.getByText(`Sedan · ${MAKE_MODEL}`)).toBeVisible();
    await expect(
        page.getByText(`We'll send the details by email to ${email}.`),
    ).toBeVisible();
    await expect(page.getByText(/is on its way/)).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(INTERNALS);
    await expect(
        page.getByRole('link', { name: 'Back to shop' }).first(),
    ).toBeVisible();
    expect(await bookingCount(page, seed.slug)).toBe(1);

    // The verified customer's vehicle is kept for next time.
    await page.goto('/account/vehicles');
    await expect(page.getByText(MAKE_MODEL)).toBeVisible();
    await page.goBack();

    // The result is durable: its own URL works again for the same customer only.
    const resultUrl = page.url();
    await page.reload();
    await expect(
        page.getByRole('heading', { level: 2, name: 'Booking confirmed' }),
    ).toBeVisible();
    await expect(page.getByText(`Sedan · ${MAKE_MODEL}`)).toBeVisible();
    expect((await other.request.get(resultUrl)).status()).toBe(404);

    // With the capacity gone, that time stays disabled for everyone.
    await other.reload();
    await resumeSchedule(other);
    await expect(
        other.getByRole('radio', { name: `${label}, unavailable` }),
    ).toBeDisabled();
    await visitor.close();
});

test('double-clicking Confirm creates exactly one booking', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const seed = await seedShop(page.request, { capacity: 1 });
    const email = `double-${Date.now()}@example.test`;

    await holdNextAvailable(page, seed.slug);
    await verifyEmail(page, email);
    await page.getByRole('button', { name: 'Confirm booking' }).dblclick();

    await expect(
        page.getByRole('heading', { level: 2, name: 'Booking confirmed' }),
    ).toBeVisible();
    expect(await bookingCount(page, seed.slug)).toBe(1);
});

test('a staff-approval shop turns the booking into a request awaiting the shop', async ({
    page,
}) => {
    test.setTimeout(120_000);
    const seed = await seedShop(page.request, {
        capacity: 1,
        approvalMode: 'staff_approval',
    });
    const email = `request-${Date.now()}@example.test`;

    await holdNextAvailable(page, seed.slug);
    await verifyEmail(page, email);
    // When the shop approves each booking the action never says it confirms.
    await expect(
        page.getByRole('button', { name: 'Confirm booking' }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Send booking request' }).click();

    await expect(
        page.getByRole('heading', { level: 2, name: 'Request sent' }),
    ).toBeVisible();
    await expect(page.getByText('not confirmed yet.')).toBeVisible();
    await expect(page.getByText('Shop decision by')).toBeVisible();
    await expect(page.getByText(/is on its way/)).toHaveCount(0);
});

test.describe('approved mobile viewport 390x844', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('keeps the primary action in a fixed bottom bar and never covers the focused field', async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const seed = await seedShop(page.request, { capacity: 1 });

        await page.goto(`/shops/${seed.slug}/book`);
        const bar = page.getByRole('group', { name: 'Booking actions' });
        await expect(bar).toBeVisible();
        await expect(bar).toContainText('Step 1 of 5');
        const box = await bar.boundingBox();
        expect(box).not.toBeNull();
        // Pinned to the bottom edge of the 844px viewport at full width.
        expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
        expect(Math.round(box?.width ?? 0)).toBe(390);

        await page.locator('label').filter({ hasText: 'Sedan' }).click();
        const field = page.getByLabel(/^Make \/ model/);
        await field.focus();
        await field.fill(MAKE_MODEL);
        const fieldBox = await field.boundingBox();
        expect(
            (fieldBox?.y ?? 0) + (fieldBox?.height ?? 0),
        ).toBeLessThanOrEqual(box?.y ?? 0);

        // All five stages stay in one ordered progress list, the current one marked.
        const steps = page.getByRole('navigation', {
            name: 'Booking progress',
        });
        await expect(steps.getByRole('listitem')).toHaveCount(5);
        await expect(steps.locator('[aria-current="step"]')).toContainText(
            'Vehicle',
        );
        // The compact summary replaces the side card; the page does not scroll sideways.
        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollWidth <=
                    document.documentElement.clientWidth,
            ),
        ).toBe(true);
    });

    test('the pending outcome fits the narrow screen with one next action', async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const seed = await seedShop(page.request, {
            capacity: 1,
            approvalMode: 'staff_approval',
        });
        await holdNextAvailable(page, seed.slug);
        await verifyEmail(page, `mobile-${Date.now()}@example.test`);
        await expect(
            page.getByRole('button', { name: 'Send booking request' }),
        ).toBeVisible();
        await page
            .getByRole('button', { name: 'Send booking request' })
            .click();

        await expect(
            page.getByRole('heading', { level: 2, name: 'Request sent' }),
        ).toBeVisible();
        await expect(
            page.getByRole('link', { name: 'Track request' }),
        ).toBeVisible();
    });
});

test.describe('approved desktop viewport 1600x1000', () => {
    test.use({ viewport: { width: 1600, height: 1000 } });

    test('shows the summary beside the step card with ordinary document actions', async ({
        page,
    }) => {
        test.setTimeout(120_000);
        const seed = await seedShop(page.request, { capacity: 1 });
        await page.goto(`/shops/${seed.slug}/book`);

        const card = page.getByRole('complementary', {
            name: 'Booking summary',
        });
        const step = page.locator('section[aria-labelledby="step-heading"]');
        await expect(card).toBeVisible();
        const [cardBox, stepBox] = await Promise.all([
            card.boundingBox(),
            step.boundingBox(),
        ]);
        expect(cardBox?.x ?? 0).toBeGreaterThan(
            (stepBox?.x ?? 0) + (stepBox?.width ?? 0) - 1,
        );
        // Not fixed to the viewport: the bar is an ordinary row inside the card.
        const bar = page.getByRole('group', { name: 'Booking actions' });
        const position = await bar.evaluate(
            (element) => getComputedStyle(element).position,
        );
        expect(position).toBe('static');
        await expect(page.locator('body')).not.toContainText(INTERNALS);
    });
});
