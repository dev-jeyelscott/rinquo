import inertia from '@inertiajs/vite';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import { defineConfig, lazyPlugins } from 'vite-plus';

// The dev server runs inside the `vite` Compose service. It listens on all
// container interfaces, while the browser on the host reaches it (and its
// HMR socket) through the published port on localhost.
const devServerPort = Number(process.env.VITE_PORT ?? 5173);
const devServerPublicHost = process.env.VITE_DEV_SERVER_HOST ?? 'localhost';

export default defineConfig({
    plugins: lazyPlugins(() => [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            fonts: [
                bunny('Instrument Sans', {
                    weights: [400, 500, 600],
                }),
            ],
        }),
        inertia(),
        react(),
        babel({
            presets: [reactCompilerPreset()],
        }),
        tailwindcss(),
    ]),
    server: {
        host: '0.0.0.0',
        port: devServerPort,
        strictPort: true,
        origin: `http://${devServerPublicHost}:${devServerPort}`,
        // Pages are served by the app on another port, so allow the local
        // app origins (Vite's default localhost-only pattern).
        cors: {
            origin: /^https?:\/\/(?:(?:[^:]+\.)?localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/,
        },
        hmr: {
            host: devServerPublicHost,
            clientPort: devServerPort,
        },
        watch: {
            ignored: [
                '**/.agent-work/**',
                '**/.agents/**',
                '**/.claude/**',
                '**/.cursor/**',
                '**/.junie/**',
                '**/docs/**',
                '**/storage/**',
                '**/vendor/**',
            ],
        },
    },
    test: {
        environment: 'jsdom',
        include: ['resources/js/**/*.test.{ts,tsx}'],
        setupFiles: ['resources/js/test/setup.ts'],
        restoreMocks: true,
    },
    lint: {
        ignorePatterns: [
            'vendor/**',
            'node_modules/**',
            'public/**',
            'bootstrap/ssr/**',
            'playwright-report/**',
            'test-results/**',
            'resources/js/components/ui/*',
        ],
        options: {
            denyWarnings: true,
            typeAware: true,
        },
    },
    fmt: {
        printWidth: 80,
        tabWidth: 4,
        singleQuote: true,
        semi: true,
        singleAttributePerLine: false,
        htmlWhitespaceSensitivity: 'css',
        ignorePatterns: [
            '.agent-work/**',
            '.github/**',
            'composer.json',
            'composer.lock',
            'docs/**',
            'playwright-report/**',
            'test-results/**',
            'resources/js/components/ui/*',
            'resources/views/mail/*',
            'storage/**',
            'vendor/**',
        ],
        sortTailwindcss: {
            functions: ['clsx', 'cn', 'cva'],
            stylesheet: 'resources/css/app.css',
        },
    },
});
