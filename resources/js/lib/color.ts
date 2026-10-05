/**
 * Picks black or white text for a #RRGGBB background using WCAG relative
 * luminance, so tenant brand colors always keep readable text on top.
 */
export function readableForeground(hex: string): '#ffffff' | '#0f172a' {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);

    if (!match) {
        return '#ffffff';
    }

    const channels = [0, 2, 4].map((offset) => {
        const value = parseInt(match[1].slice(offset, offset + 2), 16) / 255;

        return value <= 0.03928
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
    });
    const luminance =
        0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];

    return luminance > 0.4 ? '#0f172a' : '#ffffff';
}
