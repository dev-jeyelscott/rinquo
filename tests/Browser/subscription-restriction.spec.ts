import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { signIn } from './support/sign-in';

/**
 * A restricted shop against the running stack: the public page stays
 * intelligible but offers no booking, the booking wizard is closed, and Staff
 * keep working an existing booking while new walk-ins are paused.
 *
 * The shop comes from the APP_ENV=testing-only fixture route (see
 * compose.ci.yaml); the test skips with a clear message when it is absent. The
 * paid-webhook half of the journey is covered by the backend suite, because the
 * browser cannot sign a PayMongo event without the deployment webhook secret.
 */

type Seed = { slug: string; organizationId: number; staffEmail: string };

async function seedRestrictedShop(request: APIRequestContext): Promise<Seed> {
    const slug = `e2e-restricted-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await request.post('/__testing/shop', {
        data: {
            slug,
            capacity: 1,
            staff: true,
            booking_in_minutes: 30,
            entitlement: 'restricted',
        },
    });
    expect(response.ok()).toBe(true);

    return (await response.json()) as Seed;
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get('/__testing/otp?email=probe@example.test');
    test.skip(
        probe.status() === 404,
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the restriction journey.',
    );
});

test('a restricted shop shows no booking, blocks the wizard and keeps existing bookings workable', async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    const seed = await seedRestrictedShop(request);

    await page.goto(`/shops/${seed.slug}`);
    await expect(
        page.getByText('Online booking unavailable').first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Book now' })).toHaveCount(0);

    const wizard = await page.goto(`/shops/${seed.slug}/book`);
    expect(wizard?.status()).toBe(404);

    await signIn(page, seed.staffEmail);
    await page.goto(`/owner/organizations/${seed.organizationId}/operations`);
    await expect(
        page.getByText('Your subscription has ended').first(),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Add walk-in' }),
    ).toBeDisabled();

    await page
        .getByRole('button', { name: 'Check in Casey Customer', exact: true })
        .click();
    await expect(page.getByRole('list', { name: 'Queue' })).toContainText(
        'Checked in',
    );
});
