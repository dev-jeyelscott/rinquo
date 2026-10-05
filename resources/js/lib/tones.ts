/**
 * Alert colouring by tone, following the OwnerShell status region: a tinted
 * surface with a semantic border and readable foreground text. The meaning is
 * always carried by the text (and an icon), never by colour alone.
 */
export const ALERT_TONES = {
    error: 'border-destructive/40 bg-destructive/10 text-foreground [&>svg]:text-destructive',
    warning:
        'border-warning/40 bg-warning/10 text-foreground [&>svg]:text-warning',
    success:
        'border-success/40 bg-success/10 text-foreground [&>svg]:text-success',
    info: 'border-info/40 bg-info/10 text-foreground [&>svg]:text-info',
} as const;

export type AlertTone = keyof typeof ALERT_TONES;
