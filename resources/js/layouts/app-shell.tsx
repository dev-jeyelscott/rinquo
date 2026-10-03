import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { connectEcho } from '@/lib/echo';

export default function AppShell({ children }: { children: ReactNode }) {
    const { appName, realtime } = usePage().props;

    useEffect(() => {
        connectEcho(realtime);
    }, [realtime]);

    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="border-b border-border">
                <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4 sm:px-6">
                    <span className="text-base font-semibold">{appName}</span>
                </div>
            </header>
            <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6">
                {children}
            </main>
        </div>
    );
}
