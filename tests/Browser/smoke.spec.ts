import { expect, test } from '@playwright/test';

test('the shell loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') {
            errors.push(message.text());
        }
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    await expect(
        page.getByRole('heading', { level: 1, name: 'Rinquo' }),
    ).toBeVisible();
    expect(errors).toEqual([]);
});

test('the browser establishes a realtime connection to Reverb', async ({
    page,
}) => {
    await page.goto('/');

    await expect
        .poll(
            () =>
                page.evaluate(
                    () => window.Echo?.connector.pusher.connection.state,
                ),
            { timeout: 15_000 },
        )
        .toBe('connected');
});

test('the readiness endpoint reports ready', async ({ request }) => {
    const response = await request.get('/ready');

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({
        status: 'ok',
        checks: { database: 'ok', redis: 'ok' },
    });
});
