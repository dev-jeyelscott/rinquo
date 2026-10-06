import { useForm } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    CheckboxField,
    SelectField,
    TextareaField,
    TextField,
} from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { uuid, wallTimeToInstant } from '@/lib/booking-format';
import { ALERT_TONES } from '@/lib/tones';
import type { CatalogVehicle } from '@/types/booking';

type Props = {
    url: string;
    catalog: CatalogVehicle[];
    timezone: string;
    /** Set when the shop takes no new bookings (restricted or closed): the control is disabled and says why. */
    unavailableReason?: string | null;
};

type Mode = 'walk_in' | 'scheduled';

/**
 * Staff entry form for a walk-in (earliest real gap today) or a future staff
 * booking, in a contextual sheet so the live queue stays visible. The contact
 * is plain data (no account is created). Only the minimum-notice rule can be
 * waived, and only with a reason; the server enforces everything else.
 */
export function WalkInSheet({
    url,
    catalog,
    timezone,
    unavailableReason = null,
}: Props) {
    const [open, setOpen] = useState(false);
    const [key, setKey] = useState(uuid);
    const form = useForm({
        mode: 'walk_in' as Mode,
        vehicle_type_id: '',
        service_id: '',
        add_on_ids: [] as number[],
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        vehicle_plate: '',
        customer_notes: '',
        start_local: '',
        policy_exception_reason: '',
    });
    const errors = form.errors as Record<string, string | undefined>;
    const vehicle = catalog.find(
        (candidate) => String(candidate.id) === form.data.vehicle_type_id,
    );
    const service = vehicle?.services.find(
        (candidate) => String(candidate.id) === form.data.service_id,
    );
    const scheduled = form.data.mode === 'scheduled';

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.transform((data) => ({
            idempotency_key: key,
            mode: data.mode,
            vehicle_type_id: Number(data.vehicle_type_id),
            service_id: Number(data.service_id),
            add_on_ids: data.add_on_ids,
            contact_name: data.contact_name,
            contact_phone: data.contact_phone || null,
            contact_email: data.contact_email || null,
            vehicle_plate: data.vehicle_plate || null,
            customer_notes: data.customer_notes || null,
            start_at:
                data.mode === 'scheduled'
                    ? wallTimeToInstant(data.start_local, timezone)
                    : null,
            policy_exception_reason: data.policy_exception_reason || null,
        }));
        form.post(url, {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                setKey(uuid());
                setOpen(false);
            },
        });
    }

    return (
        <div className="grid gap-1">
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button
                        className="max-sm:h-11"
                        disabled={unavailableReason !== null}
                        aria-describedby={
                            unavailableReason
                                ? 'walk-in-unavailable'
                                : undefined
                        }
                    >
                        <PlusIcon aria-hidden="true" />
                        Add walk-in
                    </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:h-auto max-sm:max-h-[92%] max-sm:w-full max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0 sm:w-[40vw] sm:max-w-md sm:min-w-80">
                    <form
                        onSubmit={submit}
                        aria-label="Add walk-in or booking"
                        noValidate
                        className="grid gap-4 p-4"
                    >
                        <SheetHeader className="p-0">
                            <SheetTitle>Add a walk-in or booking</SheetTitle>
                            <SheetDescription>
                                {scheduled
                                    ? 'Book a customer for a chosen time. Opening hours, the service window and capacity still apply.'
                                    : 'The first free gap today is chosen for you, including its cleaning buffer.'}
                            </SheetDescription>
                        </SheetHeader>

                        {errors.mode ||
                        errors.idempotency_key ||
                        errors.access ? (
                            <Alert className={ALERT_TONES.error} role="alert">
                                <AlertDescription>
                                    <p>
                                        {errors.access ??
                                            errors.mode ??
                                            errors.idempotency_key}
                                    </p>
                                </AlertDescription>
                            </Alert>
                        ) : null}

                        <SelectField
                            label="Type"
                            value={form.data.mode}
                            onChange={(event) =>
                                form.setData('mode', event.target.value as Mode)
                            }
                            options={[
                                { value: 'walk_in', label: 'Walk-in, now' },
                                {
                                    value: 'scheduled',
                                    label: 'Booking, chosen time',
                                },
                            ]}
                        />
                        <SelectField
                            label="Vehicle"
                            required
                            placeholder="Choose a vehicle"
                            value={form.data.vehicle_type_id}
                            error={errors.vehicle_type_id}
                            onChange={(event) =>
                                form.setData({
                                    ...form.data,
                                    vehicle_type_id: event.target.value,
                                    service_id: '',
                                    add_on_ids: [],
                                })
                            }
                            options={catalog.map((candidate) => ({
                                value: String(candidate.id),
                                label: candidate.name,
                            }))}
                        />
                        <SelectField
                            label="Service"
                            required
                            placeholder="Choose a service"
                            value={form.data.service_id}
                            error={errors.service_id}
                            disabled={!vehicle}
                            onChange={(event) =>
                                form.setData({
                                    ...form.data,
                                    service_id: event.target.value,
                                    add_on_ids: [],
                                })
                            }
                            options={(vehicle?.services ?? []).map(
                                (candidate) => ({
                                    value: String(candidate.id),
                                    label: `${candidate.name} (${candidate.durationMinutes} min)`,
                                }),
                            )}
                        />
                        {service && service.addOns.length > 0 ? (
                            <fieldset className="grid gap-1">
                                <legend className="text-sm font-medium">
                                    Add-ons
                                </legend>
                                {service.addOns.map((addOn) => (
                                    <CheckboxField
                                        key={addOn.id}
                                        label={`${addOn.name} (+${addOn.durationMinutes} min)`}
                                        checked={form.data.add_on_ids.includes(
                                            addOn.id,
                                        )}
                                        onChange={(event) =>
                                            form.setData(
                                                'add_on_ids',
                                                event.target.checked
                                                    ? [
                                                          ...form.data
                                                              .add_on_ids,
                                                          addOn.id,
                                                      ]
                                                    : form.data.add_on_ids.filter(
                                                          (id) =>
                                                              id !== addOn.id,
                                                      ),
                                            )
                                        }
                                    />
                                ))}
                            </fieldset>
                        ) : null}

                        {scheduled ? (
                            <>
                                <TextField
                                    label="Start time (Philippine time)"
                                    type="datetime-local"
                                    required
                                    value={form.data.start_local}
                                    error={errors.start_at}
                                    onChange={(event) =>
                                        form.setData(
                                            'start_local',
                                            event.target.value,
                                        )
                                    }
                                />
                                <TextareaField
                                    label="Reason to book inside the minimum notice"
                                    hint="Only needed when the time is sooner than the notice period."
                                    maxLength={500}
                                    value={form.data.policy_exception_reason}
                                    error={errors.policy_exception_reason}
                                    onChange={(event) =>
                                        form.setData(
                                            'policy_exception_reason',
                                            event.target.value,
                                        )
                                    }
                                />
                            </>
                        ) : null}

                        <TextField
                            label="Customer name"
                            required
                            maxLength={120}
                            value={form.data.contact_name}
                            error={errors.contact_name}
                            onChange={(event) =>
                                form.setData('contact_name', event.target.value)
                            }
                        />
                        <TextField
                            label="Phone"
                            maxLength={40}
                            value={form.data.contact_phone}
                            error={errors.contact_phone}
                            onChange={(event) =>
                                form.setData(
                                    'contact_phone',
                                    event.target.value,
                                )
                            }
                        />
                        <TextField
                            label="Email"
                            type="email"
                            hint="Optional. Used only to send booking emails; no account is created."
                            value={form.data.contact_email}
                            error={errors.contact_email}
                            onChange={(event) =>
                                form.setData(
                                    'contact_email',
                                    event.target.value,
                                )
                            }
                        />
                        <TextField
                            label="Plate number"
                            maxLength={20}
                            value={form.data.vehicle_plate}
                            error={errors.vehicle_plate}
                            onChange={(event) =>
                                form.setData(
                                    'vehicle_plate',
                                    event.target.value,
                                )
                            }
                        />
                        <TextareaField
                            label="Notes"
                            maxLength={1000}
                            value={form.data.customer_notes}
                            error={errors.customer_notes}
                            onChange={(event) =>
                                form.setData(
                                    'customer_notes',
                                    event.target.value,
                                )
                            }
                        />

                        <Button
                            type="submit"
                            className="max-sm:h-11"
                            disabled={form.processing}
                            aria-busy={form.processing}
                        >
                            {form.processing ? (
                                <Spinner
                                    role="presentation"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {form.processing
                                ? 'Adding…'
                                : scheduled
                                  ? 'Add booking'
                                  : 'Add walk-in'}
                        </Button>
                    </form>
                </SheetContent>
            </Sheet>
            {unavailableReason ? (
                <p
                    id="walk-in-unavailable"
                    className="max-w-[40ch] text-xs text-muted-foreground"
                >
                    {unavailableReason}
                </p>
            ) : null}
        </div>
    );
}
