import { Head, router, useForm } from '@inertiajs/react';
import CustomerShell from '@/layouts/customer-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
type Vehicle = { id: number; plate: string; label: string | null };
export default function Vehicles({ vehicles }: { vehicles: Vehicle[] }) {
    const form = useForm({ plate: '', label: '' });
    return (
        <CustomerShell>
            <Head title="Vehicles" />
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_20rem]">
                <section>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Saved vehicles
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Only you can use these at participating shops.
                    </p>
                    <div className="mt-5 grid gap-3">
                        {vehicles.length ? (
                            vehicles.map((vehicle) => (
                                <Card key={vehicle.id}>
                                    <CardContent className="flex items-center justify-between gap-3 py-4">
                                        <span>
                                            <strong>{vehicle.plate}</strong>
                                            {vehicle.label
                                                ? ` · ${vehicle.label}`
                                                : ''}
                                        </span>
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                router.post(
                                                    `/account/vehicles/${vehicle.id}/archive`,
                                                )
                                            }
                                        >
                                            Archive
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Card>
                                <CardContent className="py-6 text-sm text-muted-foreground">
                                    No saved vehicles yet. Add one for faster
                                    booking.
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </section>
                <Card>
                    <CardHeader>
                        <CardTitle>Add a vehicle</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                form.post('/account/vehicles', {
                                    onSuccess: () => form.reset(),
                                });
                            }}
                        >
                            <Input
                                aria-label="Plate number"
                                placeholder="Plate number"
                                value={form.data.plate}
                                onChange={(e) =>
                                    form.setData('plate', e.target.value)
                                }
                            />
                            <Input
                                aria-label="Vehicle label"
                                placeholder="Label (optional)"
                                value={form.data.label}
                                onChange={(e) =>
                                    form.setData('label', e.target.value)
                                }
                            />
                            <Button disabled={form.processing}>
                                {form.processing ? 'Saving...' : 'Save vehicle'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </CustomerShell>
    );
}
