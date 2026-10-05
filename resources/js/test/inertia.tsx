import { useState } from 'react';
import type { ReactNode } from 'react';
import { vi } from 'vite-plus/test';

type Call = {
    method: string;
    url: string;
    data: Record<string, unknown>;
    options: Record<string, unknown> | undefined;
};

/** Mutable state shared between a test and the mocked `@inertiajs/react`. */
export const inertia = {
    props: {} as Record<string, unknown>,
    url: '/',
    calls: [] as Call[],
    /** Errors the next form submission fails with (cleared after use). */
    nextErrors: null as Record<string, string> | null,
    /** Keep forms in the processing state (simulates a slow request). */
    hold: false,
};

export function resetInertia(props: Record<string, unknown> = {}, url = '/') {
    inertia.props = props;
    inertia.url = url;
    inertia.calls = [];
    inertia.nextErrors = null;
    inertia.hold = false;
}

function record(
    method: string,
    url: string,
    data: Record<string, unknown>,
    options?: Record<string, unknown>,
) {
    inertia.calls.push({ method, url, data, options });
}

function useFormMock(initial: Record<string, unknown>) {
    const [data, setDataState] = useState<Record<string, unknown>>(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    let transformer: (d: Record<string, unknown>) => Record<string, unknown> = (
        d,
    ) => d;

    const submit =
        (method: string) =>
        (url: string, options?: Record<string, unknown>) => {
            record(method, url, transformer(data), options);

            if (inertia.hold) {
                setProcessing(true);

                return;
            }
            if (inertia.nextErrors) {
                setErrors(inertia.nextErrors);
                inertia.nextErrors = null;
                (options?.onError as ((e: unknown) => void) | undefined)?.({});

                return;
            }
            setErrors({});
            (options?.onSuccess as (() => void) | undefined)?.();
        };

    return {
        data,
        errors,
        processing,
        hasErrors: Object.keys(errors).length > 0,
        setData: (
            keyOrData: string | Record<string, unknown>,
            value?: unknown,
        ) =>
            setDataState((current) =>
                typeof keyOrData === 'string'
                    ? { ...current, [keyOrData]: value }
                    : { ...current, ...keyOrData },
            ),
        transform: (callback: typeof transformer) => {
            transformer = callback;
        },
        reset: (...fields: string[]) =>
            setDataState((current) =>
                fields.length === 0
                    ? initial
                    : {
                          ...current,
                          ...Object.fromEntries(
                              fields.map((f) => [f, initial[f]]),
                          ),
                      },
            ),
        clearErrors: () => setErrors({}),
        post: submit('post'),
        put: submit('put'),
        patch: submit('patch'),
        delete: submit('delete'),
    };
}

/** Factory for `vi.mock('@inertiajs/react', ...)`. */
export function inertiaModule() {
    return {
        Head: () => null,
        Link: ({
            href,
            children,
            method,
            as: _as,
            ...rest
        }: {
            href: string;
            children: ReactNode;
            method?: string;
            as?: string;
        } & Record<string, unknown>) => (
            <a href={href} data-method={method} {...rest}>
                {children}
            </a>
        ),
        usePage: () => ({ props: inertia.props, url: inertia.url }),
        useForm: useFormMock,
        router: {
            post: vi.fn(
                (
                    url: string,
                    data: unknown,
                    options?: Record<string, unknown>,
                ) => {
                    record(
                        'post',
                        url,
                        (data ?? {}) as Record<string, unknown>,
                        options,
                    );
                    (options?.onFinish as (() => void) | undefined)?.();
                },
            ),
            put: vi.fn(),
            patch: vi.fn(),
        },
    };
}
