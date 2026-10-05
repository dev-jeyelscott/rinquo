import { deflateSync, crc32 } from 'node:zlib';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Owner journey against the running stack: sign in with an emailed code,
 * create an organization, configure the minimum operating model, publish, view
 * the public page signed out (with its booking entry points), then remove capacity and see the shop go
 * unavailable.
 *
 * The sign-in code is read from a route that exists only when the app runs with
 * APP_ENV=testing (the CI compose override does this; see compose.ci.yaml). The
 * tests skip with a clear message when it is absent.
 */

function png(size: number): Buffer {
    const chunk = (type: string, data: Buffer) => {
        const body = Buffer.concat([Buffer.from(type), data]);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(data.length);
        const checksum = Buffer.alloc(4);
        checksum.writeUInt32BE(crc32(body));

        return Buffer.concat([length, body, checksum]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 0, 0, 0, 0], 8);
    const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size, 128)]);
    const pixels = deflateSync(
        Buffer.concat(Array.from({ length: size }, () => row)),
    );

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', header),
        chunk('IDAT', pixels),
        chunk('IEND', Buffer.alloc(0)),
    ]);
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

        const codeStep = page.getByLabel('Sign-in code');

        if (await codeStep.isVisible()) {
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
}

async function csrfHeaders(page: Page): Promise<Record<string, string>> {
    const cookies = await page.context().cookies();
    const token = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;

    return token ? { 'X-XSRF-TOKEN': decodeURIComponent(token) } : {};
}

test.beforeEach(async ({ request }) => {
    const probe = await request.get('/__testing/otp?email=probe@example.test');
    test.skip(
        probe.status() === 404,
        'Start the app with APP_ENV=testing (compose.ci.yaml) to run the owner journey.',
    );
});

test('a wrong sign-in code is rejected and the owner stays signed out', async ({
    page,
}) => {
    const email = `wrong-${Date.now()}@example.test`;
    await page.goto('/owner/auth/login');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Email me a code' }).click();

    await page.getByLabel('Sign-in code').fill('000000');
    await page.getByRole('button', { name: 'Verify and sign in' }).click();

    await expect(page.getByText(/invalid or has expired/)).toBeVisible();
    await page.goto('/owner');
    await expect(page).toHaveURL(/\/owner\/auth\/login/);
});

test('an owner configures, publishes and unpublishes automatically a tenant shop', async ({
    page,
    browser,
}) => {
    test.setTimeout(240_000);
    const stamp = Date.now();
    const email = `owner-${stamp}@example.test`;
    const slug = `e2e-shop-${stamp}`;

    // 1. Sign in and create the organization.
    await signIn(page, email);
    await expect(page).toHaveURL(/\/owner\/onboarding/);
    await page.getByLabel('Business name').fill(`E2E Shine ${stamp}`);
    await page.getByLabel('Shop address').fill(slug);
    await page.getByRole('button', { name: 'Create organization' }).click();
    await expect(
        page.getByRole('heading', { name: 'Scheduling configuration' }),
    ).toBeVisible();
    const settings = new URL(page.url()).pathname.replace(/\/profile$/, '');

    // 2. Publishing is disabled and a forged request fails closed.
    await page.goto(`${settings}/readiness`);
    await expect(
        page.getByRole('button', { name: 'Publish shop' }),
    ).toBeDisabled();
    const forged = await page.request.post(`${settings}/publish`, {
        headers: await csrfHeaders(page),
        maxRedirects: 0,
    });
    expect([302, 303, 422]).toContain(forged.status());
    await page.reload();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();
    expect((await page.request.get(`/shops/${slug}`)).status()).toBe(404);

    // 3. Profile, branch and a logo.
    await page.goto(`${settings}/profile`);
    await page.getByLabel(/^Tagline/).fill('Spotless every time');
    await page.getByLabel(/^Description/).fill('Hand wash and detailing.');
    await page.getByLabel(/^Street address/).fill('1 Rizal Ave');
    await page.getByLabel(/^City/).fill('Manila');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByText('Profile saved.')).toBeVisible();

    await page.getByLabel(/^Describe the photo/).fill('Shine logo');
    await page.getByLabel(/^Image file/).setInputFiles({
        name: 'logo.png',
        mimeType: 'image/png',
        buffer: png(256),
    });
    await page.getByRole('button', { name: 'Upload photo' }).click();
    await expect(page.getByText('Photo saved.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Shine logo' })).toBeVisible();

    // 4. Business hours.
    await page.goto(`${settings}/hours`);
    await page.getByRole('button', { name: 'Add interval' }).click();
    await page.getByRole('button', { name: 'Save business hours' }).click();
    await expect(page.getByText('Business hours saved.')).toBeVisible();

    // 5. Resources and capacity.
    await page.goto(`${settings}/resources`);
    await page.getByLabel(/^New resource type/).fill('Wash bay');
    await page.getByRole('button', { name: 'Add resource type' }).click();
    await expect(page.getByText('Resource type added.')).toBeVisible();
    const bay = page.getByRole('group', { name: 'Wash bay' });
    await bay.getByLabel(/^New resource name/).fill('Bay 1');
    await bay
        .getByLabel(/^Capacity/)
        .last()
        .fill('2');
    await bay.getByRole('button', { name: 'Add resource' }).click();
    await expect(page.getByText('Resource added.')).toBeVisible();

    // 6. Catalog: vehicle type, service, window, variant and consumption.
    await page.goto(`${settings}/services`);
    await page.getByLabel(/^New vehicle type/).fill('Sedan');
    await page.getByRole('button', { name: 'Add vehicle type' }).click();
    await expect(page.getByText('Vehicle type added.')).toBeVisible();
    await page.getByLabel(/^New service name/).fill('Full wash');
    await page.getByRole('button', { name: 'Add service' }).click();
    await expect(page.getByText('Service added.')).toBeVisible();

    const service = page.getByRole('group', { name: 'Full wash' });
    await service.getByRole('button', { name: 'Add interval' }).click();
    await service.getByRole('button', { name: 'Save windows' }).click();
    await expect(page.getByText('Service windows saved.')).toBeVisible();

    await service.getByLabel(/^Vehicle type/).selectOption({ label: 'Sedan' });
    await service
        .getByLabel(/^Price \(PHP\)/)
        .last()
        .fill('350');
    await service.getByRole('button', { name: 'Add variant' }).click();
    await expect(page.getByText(/Variant added/)).toBeVisible();

    // Without consumption the combination is unavailable and the Owner is told why.
    await expect(service.getByText('Unavailable')).toBeVisible();
    await expect(
        service.getByText(/No resource consumption is set/),
    ).toBeVisible();

    const consumption = service.getByRole('form', {
        name: 'Resource consumption for Full wash for Sedan',
    });
    await consumption.getByRole('button', { name: 'Add resource' }).click();
    await consumption
        .getByRole('combobox')
        .selectOption({ label: 'Wash bay (up to 2 units)' });
    await consumption.getByRole('button', { name: 'Save consumption' }).click();
    await expect(page.getByText('Resource consumption saved.')).toBeVisible();
    await expect(service.getByText('Bookable')).toBeVisible();

    // 7. Publish explicitly.
    await page.goto(`${settings}/readiness`);
    const publish = page.getByRole('button', { name: 'Publish shop' });
    await expect(publish).toBeEnabled();
    await publish.click();
    await expect(page.getByText('Your shop is published.')).toBeVisible();
    await expect(
        page.getByText(/Published on .* \(Asia\/Manila\)/),
    ).toBeVisible();

    // 8. A signed-out visitor sees the branded catalog and the booking entry points.
    const visitor = await browser.newContext();
    const shop = await visitor.newPage();
    await shop.goto(`/shops/${slug}`);
    // Hero headline is the tenant's tagline; the shop name sits under the wordmark.
    await expect(
        shop.getByRole('heading', { level: 1, name: 'Spotless every time' }),
    ).toBeVisible();
    await expect(shop.getByText(`E2E Shine ${stamp}`).first()).toBeVisible();
    await expect(
        shop.getByRole('heading', { name: 'Full wash' }),
    ).toBeVisible();
    await expect(shop.getByText('From ₱350')).toBeVisible();
    await expect(shop.getByRole('link', { name: 'Book now' })).toBeVisible();
    await expect(
        shop.getByRole('link', { name: 'Select Full wash' }),
    ).toBeVisible();
    await expect(shop.getByText('Online booking unavailable')).toHaveCount(0);
    await expect(shop.getByText('Bay 1')).toHaveCount(0);

    // 9. Removing the last capacity unpublishes the shop immediately.
    await page.goto(`${settings}/resources`);
    const resource = page.getByRole('form', { name: 'Edit resource Bay 1' });
    await resource.getByLabel('Active').uncheck();
    await resource.getByRole('button', { name: 'Save resource' }).click();
    await expect(page.getByText('Resource saved.')).toBeVisible();
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    const gone = await shop.goto(`/shops/${slug}`);
    expect(gone?.status()).toBe(404);
    await expect(
        shop.getByRole('heading', { name: 'This page is not available' }),
    ).toBeVisible();
    await expect(shop.getByText('Full wash')).toHaveCount(0);
    await visitor.close();

    // 10. Repairing capacity never republishes.
    await resource.getByLabel('Active').check();
    await resource.getByRole('button', { name: 'Save resource' }).click();
    await expect(page.getByText('Resource saved.')).toBeVisible();
    await page.goto(`${settings}/readiness`);
    await expect(
        page.getByRole('button', { name: 'Publish shop' }),
    ).toBeEnabled();

    // 11. Sign out, sign back in and resume where the owner left off.
    await page.getByRole('button', { name: 'Sign out' }).first().click();
    await expect(page).toHaveURL(/\/owner\/auth\/login/);
    await signIn(page, email);
    await expect(page).toHaveURL(/\/settings\/profile/);
    await expect(
        page.getByRole('heading', { name: 'Scheduling configuration' }),
    ).toBeVisible();
});
