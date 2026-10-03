import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';

// The Inertia Vite plugin turns every module under `resources/js/pages` into a
// page chunk in the production build. Tests live under `resources/js/test`.
describe('Inertia pages directory', () => {
    it('contains no test or spec files', () => {
        const pagesDir = join(process.cwd(), 'resources/js/pages');
        const testFiles = readdirSync(pagesDir, { recursive: true })
            .map(String)
            .filter((file) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file));

        expect(testFiles).toEqual([]);
    });
});
