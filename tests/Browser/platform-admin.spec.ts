import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { signIn } from './support/sign-in';

/**
 * Platform administration against the running stack: the real password-then-authenticator
 * sign-in, isolation from the tenant session in both directions, and a read-only support
 * session with its persistent banner, blocked mutation and exit.
 *
 * The administrator and the authenticator code come from the APP_ENV=testing-only fixture
 * (compose.ci.yaml); the test skips with a clear message when it is absent.
 */

type Admin = { email: string; password: string };

async function seedAdmin(request: APIRequestContext): Promise<Admin> {
    const email = `e2e-admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;
    const response = await request.post('/__testing/platform/admin', {
        data: { email },
    });
    expect(response.ok()).toBe(true);

    return (await response.json()) as Admin;
}

async function code(request: APIRequestContext, email: string) {
    const response = await request.get(
        `/__testing/platform/code?email=${encodeURIComponent(email)}`,
    );
    expect(response.ok()).toBe(true);

    return ((await response.json()) as { code: string }).code;
}

async function signInPlatform(
    page: Page,
    request: APIRequestContext,
    admin: Admin,
) {
    await page.goto('/platform/login');
    await page.getByLabel('Email address').fill(admin.email);
    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', { name: 'Second factor' }),
    ).toBeVisible();
    await page
        .getByLabel('Authenticator code')
        .fill(await code(request, admin.email));
    await page.getByRole('button', { name: 'Verify and sign in' }).click();
    await expect(
        page.getByRole('heading', { name: 'Platform overview' }),
    ).toBeVisible();
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get(
        '/__testing/platform/code?email=probe@example.test',
    );
    test.skip(
        probe.status() === 404 && (await probe.text()).includes('Not Found'),
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the platform journey.',
    );
});

test('a password alone never opens the platform; the second factor does', async ({
    page,
    request,
}) => {
    const admin = await seedAdmin(request);

    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform\/login$/);

    await page.getByLabel('Email address').fill(admin.email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByText('These credentials were not accepted.'),
    ).toBeVisible();

    await page.getByLabel('Password').fill(admin.password);
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(
        page.getByRole('heading', { name: 'Second factor' }),
    ).toBeVisible();

    // Password-only: the privileged page is still unreachable.
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform\/login$/);
    await page.goto('/platform/admins');
    await expect(page).toHaveURL(/\/platform\/login$/);
});

test('a tenant session cannot open the platform and an admin session cannot enter tenant routes', async ({
    browser,
    request,
}) => {
    test.setTimeout(120_000);
    const seed = await request.post('/__testing/shop', {
        data: { slug: `e2e-platform-${Date.now()}`, capacity: 1, staff: true },
    });
    expect(seed.ok()).toBe(true);
    const shop = (await seed.json()) as {
        staffEmail: string;
        organizationId: number;
    };

    const tenant = await browser.newPage();
    await signIn(tenant, shop.staffEmail);
    await tenant.goto('/platform');
    await expect(tenant).toHaveURL(/\/platform\/login$/);
    await tenant.close();

    const admin = await seedAdmin(request);
    const adminPage = await browser.newPage();
    await signInPlatform(adminPage, request, admin);
    await adminPage.goto(
        `/owner/organizations/${shop.organizationId}/operations`,
    );
    await expect(adminPage).toHaveURL(/\/owner\/auth\/login$/);
    await adminPage.close();
});

test('a read-only support session shows a persistent banner, blocks mutation and exits', async ({
    page,
    request,
}) => {
    test.setTimeout(120_000);
    const seed = await request.post('/__testing/shop', {
        data: { slug: `e2e-support-${Date.now()}`, capacity: 1, staff: true },
    });
    expect(seed.ok()).toBe(true);
    const shop = (await seed.json()) as {
        staffEmail: string;
        organizationId: number;
    };
    const admin = await seedAdmin(request);
    await signInPlatform(page, request, admin);

    await page.goto(`/platform/organizations/${shop.organizationId}`);
    await page
        .getByRole('button', {
            name: `Start a support session as ${shop.staffEmail}`,
        })
        .click();
    const dialog = page.getByRole('dialog');
    await dialog
        .getByLabel('Reason for access')
        .fill('Customer cannot see their bookings');
    await dialog.getByLabel('Support or ticket reference').fill('E2E-1');
    await dialog.getByLabel('Password').fill(admin.password);
    await dialog
        .getByLabel('Authenticator code')
        .fill(await code(request, admin.email));
    await dialog.getByRole('button', { name: 'Start support session' }).click();

    const banner = page.getByRole('region', { name: 'Support session' });
    await expect(banner).toContainText('Read-only support view');
    await expect(banner).toContainText(shop.staffEmail);
    await expect(
        banner.getByRole('button', { name: 'Exit support session' }),
    ).toBeVisible();

    // The banner persists on every support page.
    await page.getByRole('link', { name: 'Pending booking requests' }).click();
    await expect(banner).toBeVisible();
    await expect(
        page.getByRole('button', { name: /approve|decline/i }),
    ).toHaveCount(0);

    // A direct mutation with a valid CSRF token is refused before any controller runs.
    const status = await page.evaluate(async () => {
        const token = decodeURIComponent(
            document.cookie
                .split('; ')
                .find((row) => row.startsWith('XSRF-TOKEN='))
                ?.split('=')[1] ?? '',
        );
        const response = await fetch(`${location.pathname}/settings/profile`, {
            method: 'POST',
            headers: { 'X-XSRF-TOKEN': token },
        });

        return response.status;
    });
    expect(status).toBe(403);

    await banner.getByRole('button', { name: 'Exit support session' }).click();
    await expect(page).toHaveURL(
        new RegExp(`/platform/organizations/${shop.organizationId}$`),
    );
    await expect(page.getByText('Support session ended')).toBeVisible();
});
