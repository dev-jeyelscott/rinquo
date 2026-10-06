import { Head, Link } from '@inertiajs/react';
import CustomerShell from '@/layouts/customer-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
type Booking = {
    id: string;
    shop: string;
    city: string;
    status: string;
    scheduledAt: string;
    url: string;
};
export default function Bookings({ bookings }: { bookings: Booking[] }) {
    return (
        <CustomerShell>
            <Head title="My bookings" />
            <h1 className="mb-5 text-2xl font-semibold tracking-tight">
                My bookings
            </h1>
            {bookings.length ? (
                <div className="grid gap-3">
                    {bookings.map((booking) => (
                        <Card key={booking.id}>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    {booking.shop}{' '}
                                    <span className="font-normal text-muted-foreground">
                                        · {booking.city}
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
                                <span className="tabular-nums">
                                    {new Date(
                                        booking.scheduledAt,
                                    ).toLocaleString()}{' '}
                                    · {booking.status.replace('_', ' ')}
                                </span>
                                <Link
                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                    href={booking.url}
                                >
                                    View booking
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="py-8 text-sm text-muted-foreground">
                        You do not have any verified online bookings yet.{' '}
                        <Link
                            href="/account/directory"
                            className="text-primary underline"
                        >
                            Find a shop
                        </Link>
                        .
                    </CardContent>
                </Card>
            )}
        </CustomerShell>
    );
}
