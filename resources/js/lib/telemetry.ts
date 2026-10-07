import type { ErrorEvent as SentryErrorEvent } from '@sentry/react';

export type TelemetryConfig = {
    dsn: string;
    environment?: string | null;
    release?: string | null;
};

const WITHHELD = '[message withheld]';

let component: string | null = null;

/** Records the current Inertia component name: an allowlisted, non-identifying "route" tag. */
export function setTelemetryRoute(name: string): void {
    component = name;
}

/** Strips query strings and fragments from a script URL so no token or identifier can ride along. */
function bareUrl(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }

    return value.split(/[?#]/)[0];
}

/**
 * Rebuilds a browser error report from an allowlist: release, environment, exception type and
 * stack frames (function, line, column and a query-free script URL) and a route tag. Request
 * and page URLs, cookies, headers, user data, breadcrumbs, contexts, extra data and every
 * exception message are dropped. Anything unexpected drops the whole event.
 */
export function scrubBrowserEvent(
    event: SentryErrorEvent,
): SentryErrorEvent | null {
    try {
        const values = (event.exception?.values ?? []).map((value) => ({
            type: value.type,
            value: WITHHELD,
            mechanism: value.mechanism,
            stacktrace: value.stacktrace
                ? {
                      frames: (value.stacktrace.frames ?? []).map((frame) => ({
                          filename: bareUrl(frame.filename),
                          abs_path: bareUrl(frame.abs_path),
                          function: frame.function,
                          lineno: frame.lineno,
                          colno: frame.colno,
                          in_app: frame.in_app,
                      })),
                  }
                : undefined,
        }));

        return {
            event_id: event.event_id,
            type: undefined,
            level: event.level,
            timestamp: event.timestamp,
            platform: event.platform,
            release: event.release,
            environment: event.environment,
            sdk: event.sdk,
            exception: { values },
            tags: component ? { route: component } : {},
        };
    } catch {
        return null;
    }
}

/** Starts browser error tracking when the server published a DSN (staging and production only). */
export async function startTelemetry(): Promise<void> {
    // The Inertia plugin also evaluates the entry module in Node (no document).
    if (typeof document === 'undefined') {
        return;
    }

    const raw = document
        .querySelector<HTMLMetaElement>('meta[name="telemetry-config"]')
        ?.getAttribute('content');

    if (!raw) {
        return;
    }

    try {
        const config = JSON.parse(raw) as TelemetryConfig;
        const Sentry = await import('@sentry/react');

        Sentry.init({
            dsn: config.dsn,
            environment: config.environment ?? undefined,
            release: config.release ?? undefined,
            tracesSampleRate: 0,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: 0,
            // Only uncaught errors and unhandled rejections: no console, DOM, fetch or history breadcrumbs.
            defaultIntegrations: false,
            integrations: [
                Sentry.globalHandlersIntegration(),
                Sentry.dedupeIntegration(),
            ],
            beforeBreadcrumb: () => null,
            beforeSend: scrubBrowserEvent,
        });
    } catch {
        // Telemetry must never break the application.
    }
}
