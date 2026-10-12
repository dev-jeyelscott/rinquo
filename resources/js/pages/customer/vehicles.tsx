import { Head, useForm } from '@inertiajs/react';
import {
    CarFrontIcon,
    ChevronLeftIcon,
    CircleAlertIcon,
    PlusIcon,
    ShieldCheckIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AccountInfoPanel } from '@/components/customer/account-info-panel';
import { AccountPageHeader } from '@/components/customer/account-page-header';
import { AccountStateCard } from '@/components/customer/account-state-card';
import { useFocusFirstInvalid } from '@/hooks/use-focus-first-invalid';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { TextField } from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import CustomerShell from '@/layouts/customer-shell';
import { ALERT_TONES } from '@/lib/tones';
import type { SavedVehicle } from '@/types/customer';

const PRIVACY =
    'Shop staff do not gain access to other businesses’ booking activity.';

function vehicleName(vehicle: SavedVehicle): string {
    return vehicle.makeModel ?? 'Vehicle without make and model';
}

/**
 * Shared saved vehicles (Spec 06 refs 09-11). Vehicles belong to the platform
 * account; adding uses the existing save, archiving asks for a focused
 * confirmation and settles on the server. Existing bookings keep their own
 * vehicle snapshot, so archiving never changes them. There is no edit action.
 */
export default function Vehicles({ vehicles }: { vehicles: SavedVehicle[] }) {
    const [adding, setAdding] = useState(false);
    const listHeading = useRef<HTMLHeadingElement>(null);
    const returnToList = useRef(false);
    const pageHeading = useRef<HTMLHeadingElement>(null);
    const vehicleCount = useRef(vehicles.length);

    // Archiving removes the control that had focus (and its dialog), so hand focus to the page heading.
    useEffect(() => {
        if (vehicles.length < vehicleCount.current) {
            pageHeading.current?.focus();
        }
        vehicleCount.current = vehicles.length;
    }, [vehicles.length]);

    useEffect(() => {
        if (!adding && returnToList.current) {
            returnToList.current = false;
            listHeading.current?.focus();
        }
    }, [adding]);

    function closeForm() {
        returnToList.current = true;
        setAdding(false);
    }

    const addButton = adding ? null : (
        <Button
            className="h-11"
            onClick={() => setAdding(true)}
            aria-label="Add vehicle"
        >
            <PlusIcon aria-hidden="true" />
            <span className="max-sm:sr-only">Add vehicle</span>
        </Button>
    );

    return (
        <CustomerShell>
            <Head title="Saved vehicles" />
            <div className="grid gap-6">
                <AccountPageHeader
                    headingRef={pageHeading}
                    title="Saved vehicles"
                    description="Your vehicles belong to your verified Rinquo account and can be reused when booking."
                    action={addButton}
                />
                <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.6fr)]">
                    {adding ? (
                        <AddVehicleForm onDone={closeForm} />
                    ) : vehicles.length === 0 ? (
                        <AccountStateCard
                            icon={CarFrontIcon}
                            title="No saved vehicles yet"
                            action={
                                <Button
                                    className="h-11"
                                    onClick={() => setAdding(true)}
                                >
                                    <PlusIcon aria-hidden="true" />
                                    Add a vehicle
                                </Button>
                            }
                        >
                            Save a vehicle once and choose it when you book at
                            any participating shop.
                        </AccountStateCard>
                    ) : (
                        <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-6">
                            <h2
                                ref={listHeading}
                                tabIndex={-1}
                                className="text-xl font-semibold tracking-tight outline-none"
                            >
                                Your vehicles
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                You can archive a vehicle without changing
                                existing booking snapshots.
                            </p>
                            <ul className="mt-4 divide-y border-t">
                                {vehicles.map((vehicle) => (
                                    <li
                                        key={vehicle.id}
                                        className="flex items-center gap-4 py-4"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                                        >
                                            <CarFrontIcon className="size-6" />
                                        </span>
                                        <div className="grid min-w-0 flex-1 gap-1">
                                            <h3 className="font-semibold break-words">
                                                {vehicleName(vehicle)}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {vehicle.plate ??
                                                    'Plate not provided'}
                                            </p>
                                            {vehicle.label ? (
                                                <p className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                                    {vehicle.label}
                                                </p>
                                            ) : null}
                                        </div>
                                        <ConfirmAction
                                            label="Archive"
                                            ariaLabel={`Archive ${vehicleName(vehicle)}`}
                                            title="Archive this vehicle?"
                                            description={`${vehicleName(vehicle)} will be removed from your active saved vehicles. Your existing bookings will not change.`}
                                            confirmLabel="Archive vehicle"
                                            dismissLabel="Keep vehicle"
                                            url={`/account/vehicles/${vehicle.id}/archive`}
                                            networkErrorMessage="We could not reach Rinquo, so the vehicle may not be archived. Try again, or refresh to check your vehicles."
                                            returnFocus={() =>
                                                pageHeading.current
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                    <AccountInfoPanel
                        icon={ShieldCheckIcon}
                        title="Shared only with your verified account"
                        className="lg:min-h-full"
                    >
                        {PRIVACY}
                    </AccountInfoPanel>
                </div>
            </div>
        </CustomerShell>
    );
}

function AddVehicleForm({ onDone }: { onDone: () => void }) {
    const form = useForm({ make_model: '', plate: '', label: '' });
    const heading = useRef<HTMLHeadingElement>(null);
    const [offline, setOffline] = useState(false);
    const formElement = useRef<HTMLFormElement>(null);

    useEffect(() => heading.current?.focus(), []);
    useFocusFirstInvalid(formElement, form.errors);

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (form.processing) {
            return;
        }
        setOffline(false);
        form.post('/account/vehicles', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onDone();
            },
            onNetworkError: () => {
                setOffline(true);

                return false;
            },
        });
    }

    return (
        <section className="rounded-2xl border bg-card p-5 shadow-xs sm:p-7">
            <Button
                type="button"
                variant="link"
                className="h-11 px-0"
                onClick={onDone}
            >
                <ChevronLeftIcon aria-hidden="true" />
                Back to vehicles
            </Button>
            <h2
                ref={heading}
                tabIndex={-1}
                className="mt-2 text-xl font-semibold tracking-tight outline-none"
            >
                Add a vehicle
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Save it once for faster future bookings.
            </p>
            <form
                ref={formElement}
                onSubmit={submit}
                className="mt-6 grid gap-4"
                noValidate
            >
                <TextField
                    label="Make and model"
                    required
                    maxLength={120}
                    placeholder="e.g., Honda ADV 160"
                    hint="Required, up to 120 characters."
                    value={form.data.make_model}
                    onChange={(event) =>
                        form.setData('make_model', event.target.value)
                    }
                    error={form.errors.make_model}
                    controlClassName="h-11 border-booking-control"
                />
                <TextField
                    label="Plate number (optional)"
                    maxLength={20}
                    placeholder="e.g., ABC 1234"
                    value={form.data.plate}
                    onChange={(event) =>
                        form.setData('plate', event.target.value)
                    }
                    error={form.errors.plate}
                    controlClassName="h-11 border-booking-control"
                />
                <TextField
                    label="Label (optional)"
                    maxLength={120}
                    placeholder="e.g., Daily ride"
                    value={form.data.label}
                    onChange={(event) =>
                        form.setData('label', event.target.value)
                    }
                    error={form.errors.label}
                    controlClassName="h-11 border-booking-control"
                />
                {offline ? (
                    <Alert className={ALERT_TONES.error} role="alert">
                        <CircleAlertIcon aria-hidden="true" />
                        <AlertDescription>
                            We could not reach Rinquo, so the vehicle was not
                            saved. Check your connection and try again.
                        </AlertDescription>
                    </Alert>
                ) : null}
                <Button
                    type="submit"
                    className="h-12"
                    disabled={form.processing}
                    aria-busy={form.processing}
                >
                    {form.processing ? (
                        <Spinner role="presentation" aria-hidden="true" />
                    ) : (
                        <PlusIcon aria-hidden="true" />
                    )}
                    {form.processing ? 'Saving vehicle...' : 'Save vehicle'}
                </Button>
            </form>
        </section>
    );
}
