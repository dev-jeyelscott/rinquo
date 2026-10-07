import type { ErrorEvent as SentryErrorEvent } from '@sentry/react';
import { describe, expect, it } from 'vite-plus/test';
import {
    scrubBrowserEvent,
    setTelemetryRoute,
    startTelemetry,
} from '@/lib/telemetry';

function dirty(): SentryErrorEvent {
    return {
        event_id: 'abc',
        level: 'error',
        release: 'release-1',
        environment: 'staging',
        request: {
            url: 'https://rinquo.example/account/profile?token=SECRET-TOKEN',
            headers: {
                Cookie: 'SECRET-COOKIE',
                Authorization: 'Bearer SECRET',
            },
            cookies: { session: 'SECRET-COOKIE' },
            data: { password: 'SECRET-PASSWORD' },
        },
        user: { email: 'customer@example.test', ip_address: '1.2.3.4' },
        extra: { otp: '123456' },
        contexts: { page: { url: 'https://rinquo.example/x?token=SECRET' } },
        breadcrumbs: [{ message: 'clicked customer@example.test' }],
        tags: { email: 'customer@example.test' },
        exception: {
            values: [
                {
                    type: 'TypeError',
                    value: 'Cannot read email of customer@example.test at https://x/?token=SECRET',
                    stacktrace: {
                        frames: [
                            {
                                filename:
                                    'https://rinquo.example/build/assets/app-1.js?token=SECRET#frag',
                                function: 'render',
                                lineno: 10,
                                colno: 4,
                                vars: { password: 'SECRET-PASSWORD' },
                            },
                        ],
                    },
                },
            ],
        },
    } as unknown as SentryErrorEvent;
}

describe('scrubBrowserEvent', () => {
    it('keeps only release, environment, exception type, frames and a route tag', () => {
        setTelemetryRoute('owner/settings/profile');
        const clean = scrubBrowserEvent(dirty());

        expect(clean).toMatchObject({
            release: 'release-1',
            environment: 'staging',
            tags: { route: 'owner/settings/profile' },
        });
        expect(clean?.exception?.values?.[0]).toMatchObject({
            type: 'TypeError',
            value: '[message withheld]',
        });
        expect(clean?.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
            filename: 'https://rinquo.example/build/assets/app-1.js',
            abs_path: undefined,
            function: 'render',
            lineno: 10,
            colno: 4,
            in_app: undefined,
        });
    });

    it('drops request, user, extra, contexts, breadcrumbs and every secret', () => {
        const clean = scrubBrowserEvent(dirty()) as unknown as Record<
            string,
            unknown
        >;

        expect(clean.request).toBeUndefined();
        expect(clean.user).toBeUndefined();
        expect(clean.extra).toBeUndefined();
        expect(clean.contexts).toBeUndefined();
        expect(clean.breadcrumbs).toBeUndefined();

        const dump = JSON.stringify(clean);
        for (const needle of [
            'SECRET',
            'customer@example.test',
            '123456',
            '1.2.3.4',
        ]) {
            expect(dump).not.toContain(needle);
        }
    });

    it('drops the event rather than throwing on a malformed one', () => {
        const hostile = {
            get exception(): never {
                throw new Error('boom');
            },
        } as unknown as SentryErrorEvent;

        expect(scrubBrowserEvent(hostile)).toBeNull();
    });
});

describe('startTelemetry', () => {
    it('does nothing when the server published no DSN', async () => {
        document.head.querySelector('meta[name="telemetry-config"]')?.remove();

        await expect(startTelemetry()).resolves.toBeUndefined();
    });

    it('never throws on malformed configuration', async () => {
        const meta = document.createElement('meta');
        meta.name = 'telemetry-config';
        meta.content = '{not json';
        document.head.append(meta);

        await expect(startTelemetry()).resolves.toBeUndefined();
        meta.remove();
    });
});
