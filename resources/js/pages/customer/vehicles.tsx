import { Head, router, useForm } from '@inertiajs/react';
import CustomerShell from '@/layouts/customer-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
type Vehicle = {
    id: number;
    makeModel: string | null;
    plate: string | null;
    label: string | null;
};
export default function Vehicles({ vehicles }: { vehicles: Vehicle[] }) {
    const form = useForm({ make_model: '', plate: '', label: '' });
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
                                            <strong>
                                                {vehicle.makeModel ??
                                                    'Vehicle (add make and model when you book)'}
                                            </strong>
                                            {vehicle.plate
                                                ? ` · ${vehicle.plate}`
                                                : ''}
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
                                aria-label="Make and model"
                                placeholder="Make and model"
                                required
                                maxLength={120}
                                aria-invalid={
                                    form.errors.make_model ? true : undefined
                                }
                                value={form.data.make_model}
                                onChange={(e) =>
                                    form.setData('make_model', e.target.value)
                                }
                            />
                            {form.errors.make_model ? (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {form.errors.make_model}
                                </p>
                            ) : null}
                            <Input
                                aria-label="Plate number (optional)"
                                placeholder="Plate number (optional)"
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
