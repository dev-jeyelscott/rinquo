import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Reads the emailed sign-in code from the APP_ENV=testing-only peek route. */
export async function readCode(page: Page, email: string): Promise<string> {
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

/** Requests a code (waiting out the per-email resend cooldown) and signs in as Owner, Staff or a customer. */
export async function signIn(page: Page, email: string) {
    await page.goto('/owner/auth/login');

    for (let attempt = 0; attempt < 3; attempt++) {
        await page.getByLabel('Email address').fill(email);
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
