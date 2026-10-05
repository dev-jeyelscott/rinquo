export type ShopImage = { url: string; altText: string };

export type ShopPageProps = {
    appName: string;
    shop: {
        name: string;
        tagline: string;
        description: string;
        brandColor: string;
        logo: ShopImage | null;
        hero: ShopImage | null;
        gallery: ShopImage[];
    };
    branch: {
        name: string;
        addressLine: string;
        city: string;
        phone: string | null;
        timezone: string;
    };
    hours: {
        openNow: boolean;
        today: string;
        weekly: { day: string; label: string }[];
    };
    services: {
        id: number;
        name: string;
        description: string | null;
        fromPriceCentavos: number;
        variants: {
            id: number;
            vehicleType: string;
            durationMinutes: number;
            priceCentavos: number;
        }[];
    }[];
    /** False until slice 02 ships the booking journey. */
    bookingAvailable: boolean;
};
