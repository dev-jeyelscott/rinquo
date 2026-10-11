import { expect, test } from '@playwright/test';
import type { APIRequestContext, Browser, Page } from '@playwright/test';

/**
 * Staff journey against the running stack: a Staff member signs in with an
 * emailed code, opens the operations dashboard, adds a walk-in (placed in a real
 * gap), checks it in, starts and completes it, and reviews the impact of
 * blocking a resource that has a booking before anything changes.
 *
 * The shop, the Staff member and the emailed code come from routes that exist
 * only when the app runs with APP_ENV=testing (see compose.ci.yaml). The tests
 * skip with a clear message when they are absent.
 */

type Seed = {
    slug: string;
    organizationId: number;
    staffEmail: string;
    bookingId: string | null;
};

async function seedShop(
    request: APIRequestContext,
    extra: Record<string, number> = {},
): Promise<Seed> {
    const slug = `e2e-ops-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await request.post('/__testing/shop', {
        data: { slug, capacity: 1, staff: true, ...extra },
    });
    expect(response.ok()).toBe(true);

    return (await response.json()) as Seed;
}

const ownerEmail = (seed: Seed) => `${seed.slug}-owner@example.test`;

/** Minutes since local midnight in Manila: a past booking must still be today to be operable. */
function manilaMinutesSinceMidnight(): number {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).formatToParts(new Date());
    const value = (type: string) =>
        Number(parts.find((part) => part.type === type)?.value ?? 0);

    return (value('hour') % 24) * 60 + value('minute');
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

/** Requests a code (waiting out the per-email resend cooldown) and signs in. */
async function signIn(page: Page, email: string) {
    await page.goto('/owner/auth/login');

    for (let attempt = 0; attempt < 3; attempt++) {
        await page.getByLabel('Email address').fill(email);
        // Both outcomes (code step, or a cooldown error) redirect back to the login page.
        const settled = page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' &&
                new URL(response.url()).pathname === '/owner/auth/login',
        );
        await page.getByRole('button', { name: 'Email me a code' }).click();
        await settled;
        await expect(
            page.getByRole('button', { name: 'Sending code...' }),
        ).toBeHidden();

        if (await page.getByLabel('Sign-in code').isVisible()) {
            break;
        }

        const cooldown = page.getByText(/Please wait \d+ seconds/);
        await expect(cooldown).toBeVisible();
        const seconds = Number(
            /(\d+) seconds/.exec((await cooldown.textContent()) ?? '')?.[1] ??
                60,
        );
        await page.waitForTimeout((seconds + 1) * 1000);
    }

    await page.getByLabel('Sign-in code').fill(await readCode(page, email));
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(page).not.toHaveURL(/\/owner\/auth\/login/);
}

async function addWalkIn(page: Page, name: string) {
    await page.getByRole('button', { name: 'Add walk-in' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Vehicle').selectOption({ label: 'Sedan' });
    await sheet.getByLabel('Service').selectOption({ index: 1 });
    await sheet.getByLabel('Customer name').fill(name);
    await sheet.getByRole('button', { name: 'Add walk-in' }).click();
    await expect(sheet).toBeHidden();
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get('/__testing/otp?email=probe@example.test');
    test.skip(
        probe.status() === 404,
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the staff journey.',
    );
});

test('staff run a walk-in from arrival to completion and review the impact of blocking a resource', async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    const seed = await seedShop(request);
    await signIn(page, seed.staffEmail);
    await page.goto(`/owner/organizations/${seed.organizationId}/operations`);

    await expect(
        page.getByRole('heading', { name: 'Today’s operations' }),
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { name: 'Nothing booked today' }),
    ).toBeVisible();

    await addWalkIn(page, 'Walk-in Wally');
    await expect(
        page.getByRole('status').filter({ hasText: 'Added walk-in' }),
    ).toContainText('Added walk-in for Walk-in Wally');
    const queue = page.getByRole('list', { name: 'Queue' });
    await expect(queue).toContainText('Walk-in Wally');
    await expect(queue).toContainText('Booked');

    await page
        .getByRole('button', { name: 'Check in Walk-in Wally', exact: true })
        .click();
    await expect(queue).toContainText('Checked in');
    await page
        .getByRole('button', { name: 'Start Walk-in Wally', exact: true })
        .click();
    await expect(queue).toContainText('In service');
    await expect(queue).toContainText('Estimated finish');
    await page
        .getByRole('button', { name: 'Complete Walk-in Wally', exact: true })
        .click();
    await expect(queue).toContainText('Completed');

    // A second walk-in occupies the only bay, so blocking it shows the impact first and writes nothing.
    await addWalkIn(page, 'Walk-in Wendy');
    await page.getByRole('button', { name: 'Block a resource' }).click();
    const sheet = page.getByRole('dialog');
    await sheet
        .getByRole('combobox', { name: /Resource/ })
        .selectOption({ label: 'Bay 1' });
    // The form reads wall-clock time as Philippine time, whatever the browser's zone.
    const manila = (date: Date) =>
        new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        })
            .format(date)
            .replace(' ', 'T');
    const start = new Date();
    const end = new Date(start.getTime() + 6 * 3_600_000);
    await sheet.getByLabel(/From/).fill(manila(start));
    await sheet.getByLabel(/Until/).fill(manila(end));
    await sheet.getByLabel('Reason').fill('Pump repair');
    await sheet.getByRole('button', { name: 'Block resource' }).click();

    const review = page.getByRole('dialog', {
        name: '1 future booking is affected',
    });
    await expect(review).toContainText('Walk-in Wendy');
    await expect(review).toContainText('Needs a staff decision');
    await expect(review).toContainText('never contacts a customer');
    await expect(
        page.getByRole('list', { name: 'Blocked resources' }),
    ).toHaveCount(0);

    await review.getByRole('button', { name: 'Apply changes' }).click();
    await expect(review).toBeHidden();
    await expect(
        page.getByRole('list', { name: 'Blocked resources' }),
    ).toContainText('Bay 1');
    await expect(page.getByRole('navigation', { name: 'Main' })).toContainText(
        'Conflicts',
    );
});

test('a customer who arrives after the grace period is checked in late and keeps the booking', async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    test.skip(
        manilaMinutesSinceMidnight() < 50,
        'The past booking would fall on the previous Manila day.',
    );
    const seed = await seedShop(request, { booking_minutes_ago: 40 });
    await signIn(page, seed.staffEmail);
    await page.goto(`/owner/organizations/${seed.organizationId}/operations`);

    const queue = page.getByRole('list', { name: 'Queue' });
    await page
        .getByRole('button', { name: 'Booking details for Casey Customer' })
        .click();
    const details = page.getByRole('dialog', { name: 'Booking details' });
    await expect(details).toContainText('15-minute grace period ended');
    await expect(details).toContainText('checked in as a late arrival');
    await details.getByRole('button', { name: 'Check in' }).click();

    await expect(
        page.getByRole('status').filter({ hasText: 'late arrival' }),
    ).toBeVisible();
    await expect(queue).toContainText('Checked in');
    await expect(queue).toContainText('Late arrival at');
    await expect(queue).not.toContainText('No-show');
});

test('staff confirm a no-show only after the grace period, with a reason', async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    test.skip(
        manilaMinutesSinceMidnight() < 50,
        'The past booking would fall on the previous Manila day.',
    );
    const seed = await seedShop(request, { booking_minutes_ago: 40 });
    await signIn(page, seed.staffEmail);
    await page.goto(`/owner/organizations/${seed.organizationId}/operations`);

    await page
        .getByRole('button', { name: 'Booking details for Casey Customer' })
        .click();
    await page
        .getByRole('button', { name: 'Mark Casey Customer as a no-show' })
        .click();
    const confirm = page.getByRole('dialog', { name: /no-show/ });
    await expect(confirm).toContainText(
        'The 15-minute grace period has passed',
    );
    await expect(
        confirm.getByRole('button', { name: 'Confirm no-show' }),
    ).toBeDisabled();
    await confirm.getByLabel(/Reason/).fill('Did not arrive or call');
    await confirm.getByRole('button', { name: 'Confirm no-show' }).click();

    await expect(page.getByRole('list', { name: 'Queue' })).toContainText(
        'No-show',
    );
});

test('no-show is not offered while a booking is still inside its grace period', async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    test.skip(
        manilaMinutesSinceMidnight() < 10,
        'The past booking would fall on the previous Manila day.',
    );
    const seed = await seedShop(request, { booking_minutes_ago: 5 });
    await signIn(page, seed.staffEmail);
    await page.goto(`/owner/organizations/${seed.organizationId}/operations`);

    await expect(page.getByRole('list', { name: 'Queue' })).toContainText(
        'In grace period until',
    );
    await page
        .getByRole('button', { name: 'Booking details for Casey Customer' })
        .click();
    const details = page.getByRole('dialog', { name: 'Booking details' });
    await expect(details).toContainText('No-show can be confirmed from');
    await expect(
        details.getByRole('button', { name: /as a no-show/ }),
    ).toHaveCount(0);
});

async function signedInPage(browser: Browser, email: string) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signIn(page, email);

    return { context, page };
}

test('a second session updates without a reload and offline disables every transaction until reconnect', async ({
    browser,
    request,
}) => {
    test.setTimeout(180_000);
    const seed = await seedShop(request);
    const staff = await signedInPage(browser, seed.staffEmail);
    const owner = await signedInPage(browser, ownerEmail(seed));
    const url = `/owner/organizations/${seed.organizationId}/operations`;
    await staff.page.goto(url);
    await owner.page.goto(url);
    await expect(
        staff.page.getByRole('heading', { name: 'Nothing booked today' }),
    ).toBeVisible();

    await addWalkIn(owner.page, 'Walk-in Willa');
    await expect(staff.page.getByRole('list', { name: 'Queue' })).toContainText(
        'Walk-in Willa',
        { timeout: 15_000 },
    );

    await staff.context.setOffline(true);
    await expect(staff.page.getByRole('alert')).toContainText(
        'Connection lost.',
    );
    await expect(
        staff.page.getByRole('button', { name: 'Check in Walk-in Willa' }),
    ).toBeDisabled();
    await expect(
        staff.page.getByRole('button', { name: 'Add walk-in' }),
    ).toBeDisabled();

    await staff.context.setOffline(false);
    await expect(
        staff.page.getByRole('button', { name: 'Check in Walk-in Willa' }),
    ).toBeEnabled({ timeout: 20_000 });
    await expect(staff.page.getByText('Connection lost.')).toHaveCount(0);

    await staff.context.close();
    await owner.context.close();
});

test('a day with more than one page of bookings keeps every booking reachable', async ({
    page,
    request,
}) => {
    test.setTimeout(180_000);
    const seed = await seedShop(request, { filler_bookings: 205 });
    await signIn(page, seed.staffEmail);
    await page.goto(`/owner/organizations/${seed.organizationId}/operations`);

    const pager = page.getByRole('navigation', { name: 'bookings pages' });
    await expect(pager).toContainText('Showing 1–200 of 205 bookings');
    await expect(page.getByRole('list', { name: 'Queue' })).not.toContainText(
        'Filler 205',
    );

    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(page).toHaveURL(/queue_page=2/);
    await expect(pager).toContainText('Showing 201–205 of 205 bookings');
    await page
        .getByRole('button', { name: 'Check in Filler 205', exact: true })
        .click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Checked in Filler 205' }),
    ).toBeVisible();
});

test('Staff see only operational destinations on a phone and an Owner also sees Billing and Settings', async ({
    browser,
    request,
}) => {
    test.setTimeout(180_000);
    const seed = await seedShop(request);
    const url = `/owner/organizations/${seed.organizationId}/operations`;

    const staff = await signedInPage(browser, seed.staffEmail);
    await staff.page.setViewportSize({ width: 390, height: 844 });
    await staff.page.goto(url);
    const tabs = staff.page.getByRole('navigation', { name: 'Primary mobile' });
    await expect(tabs.getByRole('link')).toHaveText([
        'Dashboard',
        'Queue',
        'Bookings',
        'Walk-in',
        'More',
    ]);
    await tabs.getByRole('link', { name: 'More' }).click();
    await expect(staff.page).toHaveURL(/view=more/);
    const more = staff.page.getByRole('navigation', {
        name: 'More destinations',
    });
    await expect(
        more.getByRole('link', { name: 'Booking Requests' }),
    ).toBeVisible();
    await expect(more.getByRole('link', { name: /Conflicts/ })).toBeVisible();
    await expect(more.getByRole('link', { name: /Billing/ })).toHaveCount(0);
    await expect(more.getByRole('link', { name: /Settings/ })).toHaveCount(0);
    // A forged request is still denied by the server.
    const forged = await staff.page.request.get(
        `/owner/organizations/${seed.organizationId}/settings/billing`,
    );
    expect(forged.status()).toBe(403);
    await staff.context.close();

    const owner = await signedInPage(browser, ownerEmail(seed));
    await owner.page.setViewportSize({ width: 390, height: 844 });
    await owner.page.goto(`${url}?view=more`);
    const ownerMore = owner.page.getByRole('navigation', {
        name: 'More destinations',
    });
    await expect(
        ownerMore.getByRole('link', { name: /Billing/ }),
    ).toBeVisible();
    await expect(
        ownerMore.getByRole('link', { name: /Settings/ }),
    ).toBeVisible();
    await owner.context.close();
});

test('an Owner changes the late-arrival grace and Staff cannot', async ({
    browser,
    request,
}) => {
    test.setTimeout(180_000);
    const seed = await seedShop(request);
    const owner = await signedInPage(browser, ownerEmail(seed));
    const policy = `/owner/organizations/${seed.organizationId}/settings/booking-policy`;
    await owner.page.goto(policy);

    const grace = owner.page.getByLabel(/Late-arrival grace/);
    await expect(grace).toHaveValue('15');
    await grace.fill('30');
    await owner.page
        .getByRole('button', { name: 'Save booking policy' })
        .click();
    await expect(
        owner.page
            .getByRole('status')
            .filter({ hasText: 'Booking policy saved.' }),
    ).toBeVisible();
    await owner.page.reload();
    await expect(owner.page.getByLabel(/Late-arrival grace/)).toHaveValue('30');
    await owner.context.close();

    const staff = await signedInPage(browser, seed.staffEmail);
    const response = await staff.page.request.get(policy);
    expect(response.status()).toBe(403);
    await staff.context.close();
});
