const wholePesos = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});
const pesosAndCentavos = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

/** Formats integer centavos as pesos: 35000 -> "₱350", 35050 -> "₱350.50". */
export function formatCentavos(centavos: number): string {
    return (centavos % 100 === 0 ? wholePesos : pesosAndCentavos).format(
        centavos / 100,
    );
}

/** "350" or "350.50" (pesos) -> integer centavos; null when not a valid amount. */
export function pesosToCentavos(input: string): number | null {
    const value = input.trim();

    if (!/^\d+(\.\d{1,2})?$/.test(value)) {
        return null;
    }

    return Math.round(Number(value) * 100);
}

/** Integer centavos -> editable pesos string ("350" or "350.50"). */
export function centavosToPesos(centavos: number): string {
    return (centavos / 100).toFixed(2).replace(/\.00$/, '');
}
