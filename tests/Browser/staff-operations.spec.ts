import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';

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

type Seed = { slug: string; organizationId: number; staffEmail: string };

async function seedShop(request: APIRequestContext): Promise<Seed> {
    const slug = `e2e-ops-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const response = await request.post('/__testing/shop', {
        data: { slug, capacity: 1, staff: true },
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
    await expect(page.getByRole('status')).toContainText(
        'Added walk-in for Walk-in Wally',
    );
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
    await expect(queue).toContainText('Expected finish');
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
