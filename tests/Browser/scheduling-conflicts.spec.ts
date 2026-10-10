import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { signIn } from './support/sign-in';

/**
 * Scheduling-conflict journey against the running stack: a customer holds a
 * confirmed booking in a few hours; Staff block the only bay, review the
 * impact, find an explicit conflict, and send the customer a proposal. The
 * customer declines (the original stays confirmed), a stale Staff page is
 * told so and refreshed, Staff propose again and the customer accepts.
 *
 * The shop, the Staff member, the customer's booking and the emailed codes come
 * from routes that exist only when the app runs with APP_ENV=testing (see
 * compose.ci.yaml). The tests skip with a clear message when they are absent.
 */

type Seed = {
    slug: string;
    organizationId: number;
    staffEmail: string;
    customerEmail: string;
    bookingId: string;
};

async function seedShop(request: APIRequestContext): Promise<Seed> {
    const slug = `e2e-conf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await request.post('/__testing/shop', {
        data: { slug, capacity: 1, staff: true, booking_in_minutes: 180 },
    });
    expect(response.ok()).toBe(true);

    return (await response.json()) as Seed;
}

/** The block form reads wall-clock time as Philippine time, whatever the browser's zone. */
function manila(date: Date): string {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
        .format(date)
        .replace(' ', 'T');
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get('/__testing/otp?email=probe@example.test');
    test.skip(
        probe.status() === 404,
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the conflict journey.',
    );
});

test('staff resolve a blocked-bay conflict with a customer-approved replacement time', async ({
    page,
    browser,
    request,
}) => {
    test.setTimeout(240_000);
    const seed = await seedShop(request);
    const base = `/owner/organizations/${seed.organizationId}`;

    // Staff block the only bay: the impact is reviewed first, then applied.
    await signIn(page, seed.staffEmail);
    await page.goto(`${base}/operations`);
    await page.getByRole('button', { name: 'Block a resource' }).click();
    const sheet = page.getByRole('dialog');
    await sheet
        .getByRole('combobox', { name: /Resource/ })
        .selectOption({ label: 'Bay 1' });
    const start = new Date();
    await sheet.getByLabel(/From/).fill(manila(start));
    await sheet
        .getByLabel(/Until/)
        .fill(manila(new Date(start.getTime() + 6 * 3_600_000)));
    await sheet.getByLabel('Reason').fill('Pump repair');
    await sheet.getByRole('button', { name: 'Block resource' }).click();

    const review = page.getByRole('dialog', {
        name: '1 future booking is affected',
    });
    await expect(review).toContainText('Casey Customer');
    await expect(review).toContainText('1 need staff action');
    await review.getByRole('button', { name: 'Apply changes' }).click();
    await expect(review).toBeHidden();

    // The conflict is explicit, the customer has not been contacted, and the original is protected.
    await page.getByRole('link', { name: /^Conflicts/ }).click();
    await expect(
        page.getByRole('heading', { name: 'Scheduling conflicts', level: 1 }),
    ).toBeVisible();
    await expect(
        page.getByText('Booking cannot be fulfilled as scheduled'),
    ).toBeVisible();
    await expect(page.getByText(/Bay 1 is blocked/)).toBeVisible();
    await expect(
        page.getByText('Original slot remains reserved'),
    ).toBeVisible();
    await expect(page.getByText('Needs proposal').first()).toBeVisible();

    // Staff choose a replacement time and confirm sending it.
    const send = page.getByRole('button', {
        name: 'Send a reschedule proposal to Casey Customer',
    });
    await expect(send).toBeDisabled();
    await page.getByRole('radio').first().check();
    await send.click();
    await page.getByRole('button', { name: 'Send proposal' }).click();
    await expect(
        page.getByRole('status').filter({ hasText: 'Proposal sent' }),
    ).toContainText('original time stays reserved');
    await expect(page.getByText('Awaiting reply').first()).toBeVisible();
    await expect(page.getByText(/Hold expires in/)).toBeVisible();

    // The customer sees the original as still confirmed and declines.
    const customerContext = await browser.newContext();
    const customer = await customerContext.newPage();
    await signIn(customer, seed.customerEmail);
    const bookingUrl = `/shops/${seed.slug}/bookings/${seed.bookingId}`;
    await customer.goto(bookingUrl);
    const proposal = customer.getByRole('region', {
        name: 'Review proposed time',
    });
    await expect(proposal).toContainText('Confirmed and still reserved');
    await expect(proposal).toContainText('Requested replacement');
    await expect(proposal).not.toContainText(/Bay 1/);
    await proposal
        .getByRole('button', { name: 'Keep my original time' })
        .click();
    await expect(proposal).toBeHidden();
    await expect(
        customer.getByRole('heading', { name: 'Booking confirmed' }),
    ).toBeVisible();

    // Staff's page is stale: the action is rejected with a way to refresh, never applied.
    await page
        .getByRole('button', {
            name: 'Withdraw the proposal to Casey Customer',
        })
        .click();
    await page
        .getByRole('button', { name: 'Withdraw proposal' })
        .last()
        .click();
    await expect(page.getByRole('alert').first()).toContainText(
        'This conflict changed',
    );
    await page.getByRole('button', { name: 'Refresh the conflict' }).click();
    await expect(page.getByText('Declined, needs staff').first()).toBeVisible();
    await expect(page.getByText(/declined the proposed time/)).toBeVisible();

    // Staff propose again; the customer accepts and the booking moves.
    await page.getByRole('radio').first().check();
    await page
        .getByRole('button', {
            name: 'Send a reschedule proposal to Casey Customer',
        })
        .click();
    await page.getByRole('button', { name: 'Send proposal' }).click();
    await expect(page.getByText('Awaiting reply').first()).toBeVisible();

    await customer.goto(bookingUrl);
    await customer
        .getByRole('button', { name: 'Accept new time' })
        .first()
        .click();
    await customer
        .getByRole('dialog')
        .getByRole('button', { name: 'Accept new time' })
        .click();
    await expect(
        customer.getByRole('heading', { name: 'Booking confirmed' }),
    ).toBeVisible();
    await expect(customer).not.toHaveURL(new RegExp(seed.bookingId));
    await customer.goto(bookingUrl);
    await expect(
        customer.getByRole('heading', { name: 'Booking rescheduled' }),
    ).toBeVisible();

    await page.goto(`${base}/scheduling-conflicts`);
    await expect(page.getByText('No scheduling conflicts')).toBeVisible();
    await expect(
        page.getByRole('list', { name: 'Recently resolved' }),
    ).toContainText('Customer accepted');
    await customerContext.close();
});
