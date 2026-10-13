/**
 * Alert colouring by tone, following the OwnerShell status region: a tinted
 * surface with a semantic border, a tone icon, and title and body text in the
 * tone's text token (Decision 221). Each `<tone>-text` token reaches 4.5:1
 * against its own tint in light and dark themes (see status-tint-contrast.test).
 * The meaning is always carried by the text (and an icon), never by colour alone.
 */
export const ALERT_TONES = {
    error: 'border-destructive/40 bg-destructive/10 text-destructive-text [&>svg]:text-destructive *:data-[slot=alert-description]:text-destructive-text',
    warning:
        'border-warning/40 bg-warning/10 text-warning-text [&>svg]:text-warning *:data-[slot=alert-description]:text-warning-text',
    success:
        'border-success/40 bg-success/10 text-success-text [&>svg]:text-success *:data-[slot=alert-description]:text-success-text',
    info: 'border-info/40 bg-info/10 text-info-text [&>svg]:text-info *:data-[slot=alert-description]:text-info-text',
} as const;

export type AlertTone = keyof typeof ALERT_TONES;
