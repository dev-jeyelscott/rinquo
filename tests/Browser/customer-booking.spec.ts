import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Customer journey against the running stack, signed out: open a published
 * shop, choose a vehicle, service and add-on, pick the next available time,
 * enter details, verify the emailed code, confirm and see the booking. A second
 * browser then finds that time disabled, and a double click on Confirm makes
 * exactly one booking.
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
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.locator('label').filter({ hasText: 'Full wash' }).click();
    await page.locator('label').filter({ hasText: 'Wax' }).click();
    await expect(
        page.getByRole('complementary', { name: 'Booking summary' }),
    ).toContainText('₱500');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: 'Next available' }).click();
    const chosen = page.getByRole('radio', { name: TIME, checked: true });
    await expect(chosen).toBeVisible();
    const label = ((await chosen.textContent()) ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    const wizardUrl = page.url();

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', { name: 'Who is this booking for?' }),
    ).toBeVisible();
    await expect(page.getByRole('timer')).toBeVisible();

    return { wizardUrl, label };
}

async function verifyEmail(page: Page, email: string) {
    await page.getByLabel(/^Full name/).fill('Ana Cruz');
    await page.getByLabel(/^Email address/).fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();

    await page
        .getByLabel(/^Verification code/)
        .fill(await readCode(page, email));
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
    await expect(
        other.getByRole('radio', { name: `${label}, unavailable` }),
    ).toBeDisabled();

    await verifyEmail(page, email);
    await page.getByRole('button', { name: 'Confirm booking' }).click();

    await expect(
        page.getByRole('heading', { level: 1, name: 'Booking confirmed' }),
    ).toBeVisible();
    await expect(page.getByText('Full wash for your Sedan')).toBeVisible();
    await expect(
        page.getByText(`An email to ${email} is on its way.`),
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: /^Back to Fixture/ }),
    ).toBeVisible();
    expect(await bookingCount(page, seed.slug)).toBe(1);

    // The result is durable: its own URL works again for the same customer only.
    const resultUrl = page.url();
    await page.reload();
    await expect(
        page.getByRole('heading', { level: 1, name: 'Booking confirmed' }),
    ).toBeVisible();
    expect((await other.request.get(resultUrl)).status()).toBe(404);

    // With the capacity gone, that time stays disabled for everyone.
    await other.reload();
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
        page.getByRole('heading', { level: 1, name: 'Booking confirmed' }),
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
    await page.getByRole('button', { name: 'Confirm booking' }).click();

    await expect(
        page.getByRole('heading', { level: 1, name: 'Request sent' }),
    ).toBeVisible();
    await expect(page.getByText(/The shop will confirm by/)).toBeVisible();
});
