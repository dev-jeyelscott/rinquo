import { describe, expect, it } from 'vite-plus/test';
import { centavosToPesos, formatCentavos, pesosToCentavos } from '@/lib/money';

describe('money', () => {
    it('formats integer centavos as pesos', () => {
        expect(formatCentavos(35000)).toBe('₱350');
        expect(formatCentavos(35050)).toBe('₱350.50');
    });

    it('parses pesos into integer centavos', () => {
        expect(pesosToCentavos('350')).toBe(35000);
        expect(pesosToCentavos(' 350.5 ')).toBe(35050);
        expect(pesosToCentavos('0.07')).toBe(7);
    });

    it('rejects invalid amounts', () => {
        for (const bad of ['', 'abc', '-5', '1.234', '1,000', '1e3']) {
            expect(pesosToCentavos(bad)).toBeNull();
        }
    });

    it('round trips through the editable representation', () => {
        expect(centavosToPesos(35000)).toBe('350');
        expect(centavosToPesos(35050)).toBe('350.50');
        expect(pesosToCentavos(centavosToPesos(1999))).toBe(1999);
    });
});
