import type {
    BookingPageProps,
    ConfirmPageProps,
    DetailsPageProps,
    HoldSummary,
    WizardPageProps,
} from '@/types/booking';

export const shell = {
    appName: 'Rinquo',
    shop: {
        name: 'Shine Auto Spa',
        tagline: 'Spotless every time',
        description: 'Hand wash and detailing.',
        brandColor: '#1E40AF',
        logo: null,
        hero: null,
        gallery: [],
    },
    branch: {
        name: 'Main',
        addressLine: '1 Rizal Ave',
        city: 'Manila',
        phone: '+63 2 1234 5678',
        timezone: 'Asia/Manila',
    },
    hours: { openNow: true, today: '8:00 AM - 6:00 PM', weekly: [] },
};

// 2026-10-06 in Manila: 09:00 and 09:15 are 01:00Z and 01:15Z.
export const T0900 = '2026-10-06T01:00:00+00:00';
export const T0915 = '2026-10-06T01:15:00+00:00';
export const T0930 = '2026-10-06T01:30:00+00:00';

export const wizardProps: WizardPageProps = {
    ...shell,
    catalog: [
        {
            id: 1,
            name: 'Sedan',
            services: [
                {
                    id: 10,
                    name: 'Full wash',
                    description: 'Hand wash and dry.',
                    priceCentavos: 35000,
                    durationMinutes: 60,
                    bufferMinutes: 10,
                    addOns: [
                        {
                            id: 100,
                            name: 'Wax',
                            priceCentavos: 15000,
                            durationMinutes: 20,
                        },
                    ],
                },
            ],
        },
        { id: 2, name: 'SUV', services: [] },
    ],
    dates: [
        { date: '2026-10-05', closed: false },
        { date: '2026-10-06', closed: false },
        { date: '2026-10-07', closed: true },
    ],
    policy: { minNoticeMinutes: 60, horizonDays: 30 },
    selection: { vehicle: null, service: null, addOns: [], date: null },
    availability: null,
    nextAvailable: null,
    urls: {
        holds: '/shops/shine/book/holds',
        shop: '/shops/shine',
        wizard: '/shops/shine/book',
    },
};

export const summary: HoldSummary = {
    serviceName: 'Full wash',
    vehicleName: 'Sedan',
    addOns: [{ id: 100, name: 'Wax', priceCentavos: 15000 }],
    priceCentavos: 35000,
    totalCentavos: 50000,
    durationMinutes: 80,
    bufferMinutes: 10,
    startAt: T0900,
    timezone: 'Asia/Manila',
    vehicleTypeId: 1,
    serviceId: 10,
    addOnIds: [100],
};

const holdUrls = {
    details: '/shops/shine/book/holds/h1/details',
    code: '/shops/shine/book/holds/h1/code',
    verify: '/shops/shine/book/holds/h1/verify',
    restart: '/shops/shine/book/holds/h1/restart',
    confirm: '/shops/shine/book/holds/h1/confirm',
    wizard: '/shops/shine/book?vehicle=1&service=10',
    shop: '/shops/shine',
};

export const detailsProps: DetailsPageProps = {
    ...shell,
    hold: { publicId: 'h1', expiresInSeconds: 600, expired: false },
    summary,
    signedIn: false,
    urls: holdUrls,
    contact: { name: '', phone: '', plate: '', notes: '' },
    verification: {
        step: 'details',
        email: null,
        resendInSeconds: 0,
        codeLength: 6,
        cooldownSeconds: 60,
    },
};

export const confirmProps: ConfirmPageProps = {
    ...shell,
    hold: { publicId: 'h1', expiresInSeconds: 600, expired: false },
    summary,
    signedIn: true,
    urls: holdUrls,
    contact: {
        name: 'Ana Cruz',
        phone: '+63 912',
        plate: 'ABC 123',
        notes: null,
    },
    customerEmail: 'ana@example.test',
};

export const bookingProps: BookingPageProps = {
    ...shell,
    booking: {
        publicId: 'b1',
        status: 'confirmed',
        serviceName: 'Full wash',
        vehicleName: 'Sedan',
        addOns: [{ name: 'Wax', priceCentavos: 15000 }],
        totalCentavos: 50000,
        durationMinutes: 80,
        bufferMinutes: 10,
        startAt: T0900,
        timezone: 'Asia/Manila',
        pendingExpiresAt: null,
        contactName: 'Ana Cruz',
        contactEmail: 'ana@example.test',
    },
    urls: { shop: '/shops/shine' },
};
