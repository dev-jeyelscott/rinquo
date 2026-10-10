/**
 * Alert colouring by tone, following the OwnerShell status region: a tinted
 * surface with a semantic border and readable foreground text. The meaning is
 * always carried by the text (and an icon), never by colour alone.
 */
export const ALERT_TONES = {
    error: 'border-destructive/40 bg-destructive/10 text-foreground [&>svg]:text-destructive *:data-[slot=alert-description]:text-foreground',
    warning:
        'border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning *:data-[slot=alert-description]:text-foreground',
    success:
        'border-success/40 bg-success/10 text-foreground [&>svg]:text-success *:data-[slot=alert-description]:text-foreground',
    info: 'border-info/40 bg-info/10 text-foreground [&>svg]:text-info *:data-[slot=alert-description]:text-foreground',
} as const;

export type AlertTone = keyof typeof ALERT_TONES;
