import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

const css = readFileSync('resources/css/app.css', 'utf8');

function token(name: string, block: 'root' | 'dark'): string {
    const start = css.indexOf(block === 'root' ? ':root {' : '.dark {');
    const body = css.slice(start, css.indexOf('\n}', start));
    const match = body.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));

    if (!match) {
        throw new Error(`Token --${name} not found`);
    }

    return match[1];
}

const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const mix = (fg: number[], bg: number[], alpha: number) =>
    fg.map((v, i) => alpha * v + (1 - alpha) * bg[i]);

const luminance = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
        const x = v / 255;

        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (hi + 0.05) / (lo + 0.05);
};

describe('tinted status text tokens (SC 1.4.3)', () => {
    const white = [255, 255, 255];
    const page = mix(rgb(token('secondary', 'root')), white, 0.6);

    it.each(['success', 'warning'])(
        '%s-text reaches 4.5:1 on its 10%% tint over white and over the page background',
        (tone) => {
            const text = rgb(token(`${tone}-text`, 'root'));

            for (const surface of [white, page]) {
                const tint = mix(rgb(token(tone, 'root')), surface, 0.1);
                expect(ratio(text, tint)).toBeGreaterThanOrEqual(4.5);
            }
        },
    );

    it.each(['success', 'warning'])(
        'dark theme %s-text reaches 4.5:1 on its tint over the dark background',
        (tone) => {
            const dark = rgb(token('background', 'dark'));
            const tint = mix(rgb(token(tone, 'dark')), dark, 0.1);
            expect(
                ratio(rgb(token(`${tone}-text`, 'dark')), tint),
            ).toBeGreaterThanOrEqual(4.5);
        },
    );

    it('muted-foreground off track reaches 3:1 on the card (SC 1.4.11)', () => {
        expect(
            ratio(
                rgb(token('muted-foreground', 'root')),
                rgb(token('card', 'root')),
            ),
        ).toBeGreaterThanOrEqual(3);
    });
});
