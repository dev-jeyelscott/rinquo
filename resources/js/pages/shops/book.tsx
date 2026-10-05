import { Head, Link, router, useForm } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookingSummaryCard } from '@/components/booking/booking-summary-card';
import { ChoiceCard } from '@/components/booking/choice-card';
import { ExactStartTimeSelector } from '@/components/booking/exact-start-time-selector';
import type { SelectorStatus } from '@/components/booking/exact-start-time-selector';
import {
    BOOKING_STEPS,
    StepIndicator,
} from '@/components/booking/step-indicator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useOnline } from '@/hooks/use-online';
import { formatDayAndTime, localDateOf, uuid } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { ALERT_TONES } from '@/lib/tones';
import { cn } from '@/lib/utils';
import type { WizardPageProps } from '@/types/booking';

type Step = 'vehicle' | 'service' | 'schedule';

/**
 * The booking wizard: Vehicle, Service and add-ons, then Schedule. The
 * selection lives in the query string so availability and the next available
 * start load as partial reloads; Continue on Schedule places the hold. The
 * server stays authoritative: a time shown here can be taken by the time the
 * customer continues, which is a normal outcome with its own message.
 */
export default function Book({
    shop,
    branch,
    catalog,
    dates,
    policy,
    selection,
    availability = null,
    nextAvailable = null,
    urls,
}: WizardPageProps) {
    const online = useOnline();
    const [vehicleId, setVehicleId] = useState(selection.vehicle);
    const [serviceId, setServiceId] = useState(selection.service);
    const [addOnIds, setAddOnIds] = useState<number[]>(selection.addOns);
    const [date, setDate] = useState(selection.date);
    const [startAt, setStartAt] = useState<string | null>(null);
    const [step, setStep] = useState<Step>(
        selection.vehicle && selection.service
            ? 'schedule'
            : selection.vehicle
              ? 'service'
              : 'vehicle',
    );
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<'error' | 'offline' | null>(null);
    // The server looks the next start up whenever vehicle and service are in the URL.
    const [nextKnown, setNextKnown] = useState(
        selection.vehicle !== null && selection.service !== null,
    );

    const vehicle = catalog.find((entry) => entry.id === vehicleId) ?? null;
    const service =
        vehicle?.services.find((entry) => entry.id === serviceId) ?? null;
    const chosenAddOns = useMemo(
        () =>
            service?.addOns.filter((addOn) => addOnIds.includes(addOn.id)) ??
            [],
        [service, addOnIds],
    );

    const durationMinutes = service
        ? service.durationMinutes +
          chosenAddOns.reduce((sum, addOn) => sum + addOn.durationMinutes, 0)
        : null;
    const totalCentavos = service
        ? service.priceCentavos +
          chosenAddOns.reduce((sum, addOn) => sum + addOn.priceCentavos, 0)
        : null;

    // One idempotency key per selection attempt: retries replay, changes start over.
    const attempt = useRef({ signature: '', key: '' });
    const signature = [
        vehicleId,
        serviceId,
        [...addOnIds].sort((a, b) => a - b).join('.'),
        startAt,
    ].join('|');
    if (attempt.current.signature !== signature) {
        attempt.current = { signature, key: uuid() };
    }

    const hold = useForm({
        idempotency_key: '',
        vehicle_type_id: 0,
        service_id: 0,
        add_on_ids: [] as number[],
        start_at: '',
    });

    const load = useCallback(
        (next: {
            vehicle: number;
            service: number;
            addOns: number[];
            date: string | null;
        }) => {
            if (!navigator.onLine) {
                setFailure('offline');

                return;
            }

            setFailure(null);
            router.get(
                urls.wizard,
                {
                    vehicle: next.vehicle,
                    service: next.service,
                    addOns: next.addOns,
                    ...(next.date ? { date: next.date } : {}),
                },
                {
                    only: ['availability', 'nextAvailable'],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    onStart: () => setLoading(true),
                    onSuccess: () => setNextKnown(true),
                    onError: () => setFailure('error'),
                    onNetworkError: () => setFailure('offline'),
                    onHttpException: () => {
                        setFailure('error');

                        return false;
                    },
                    onFinish: () => setLoading(false),
                },
            );
        },
        [urls.wizard],
    );

    // Choose the first open date when Schedule is reached without one.
    const firstOpen = dates.find((day) => !day.closed)?.date ?? null;
    useEffect(() => {
        if (
            step === 'schedule' &&
            vehicleId &&
            serviceId &&
            date === null &&
            firstOpen
        ) {
            setDate(firstOpen);
            load({
                vehicle: vehicleId,
                service: serviceId,
                addOns: addOnIds,
                date: firstOpen,
            });
        }
    }, [step, vehicleId, serviceId, date, firstOpen, addOnIds, load]);

    // A time that is no longer offered after a reload is dropped from the selection.
    useEffect(() => {
        if (
            startAt &&
            availability &&
            !availability.times.some(
                (slot) => slot.startAt === startAt && slot.available,
            )
        ) {
            setStartAt(null);
        }
    }, [availability, startAt]);

    function chooseVehicle(id: number) {
        const next = catalog.find((entry) => entry.id === id);
        setVehicleId(id);
        setServiceId(
            selection.service &&
                next?.services.some((s) => s.id === selection.service)
                ? selection.service
                : null,
        );
        setAddOnIds([]);
        setStartAt(null);
    }

    function chooseService(id: number) {
        setServiceId(id);
        setAddOnIds([]);
        setStartAt(null);
        setNextKnown(false);
    }

    function toggleAddOn(id: number, checked: boolean) {
        setAddOnIds((current) =>
            checked
                ? [...current, id]
                : current.filter((value) => value !== id),
        );
        setStartAt(null);
        setNextKnown(false);
    }

    function goToSchedule() {
        if (!vehicleId || !serviceId) {
            return;
        }
        setStep('schedule');
        if (date) {
            load({
                vehicle: vehicleId,
                service: serviceId,
                addOns: addOnIds,
                date,
            });
        }
    }

    function changeDate(next: string) {
        setDate(next);
        setStartAt(null);
        if (vehicleId && serviceId) {
            load({
                vehicle: vehicleId,
                service: serviceId,
                addOns: addOnIds,
                date: next,
            });
        }
    }

    function retry() {
        if (vehicleId && serviceId) {
            load({
                vehicle: vehicleId,
                service: serviceId,
                addOns: addOnIds,
                date,
            });
        }
    }

    function jumpToNext() {
        if (!nextAvailable || !vehicleId || !serviceId) {
            return;
        }
        const target = localDateOf(nextAvailable.startAt, branch.timezone);
        setDate(target);
        setStartAt(nextAvailable.startAt);
        if (target !== availability?.date) {
            load({
                vehicle: vehicleId,
                service: serviceId,
                addOns: addOnIds,
                date: target,
            });
        }
    }

    function reserve() {
        if (!vehicleId || !serviceId || !startAt) {
            return;
        }
        hold.transform(() => ({
            idempotency_key: attempt.current.key,
            vehicle_type_id: vehicleId,
            service_id: serviceId,
            add_on_ids: addOnIds,
            start_at: startAt,
        }));
        hold.post(urls.holds, {
            preserveScroll: true,
            onError: (errors) => {
                if (errors.start_at) {
                    setStartAt(null);
                    retry();
                }
            },
        });
    }

    const status: SelectorStatus = failure ?? (loading ? 'loading' : 'ready');
    const holdError =
        hold.errors.start_at ??
        hold.errors.idempotency_key ??
        hold.errors.service_id ??
        hold.errors.add_on_ids;

    return (
        <>
            <Head title={`Book at ${shop.name}`} />
            <div className="grid gap-6">
                <div className="grid gap-4">
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Book an appointment
                    </h1>
                    <StepIndicator steps={BOOKING_STEPS} current={step} />
                </div>

                <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
                    <section
                        aria-labelledby="step-heading"
                        className="grid gap-5"
                    >
                        {step === 'vehicle' ? (
                            <VehicleStep
                                catalog={catalog}
                                vehicleId={vehicleId}
                                onChoose={chooseVehicle}
                                onContinue={() => setStep('service')}
                                shopUrl={urls.shop}
                            />
                        ) : null}

                        {step === 'service' && vehicle ? (
                            <ServiceStep
                                vehicleName={vehicle.name}
                                services={vehicle.services}
                                serviceId={serviceId}
                                addOnIds={addOnIds}
                                onChoose={chooseService}
                                onToggleAddOn={toggleAddOn}
                                onBack={() => setStep('vehicle')}
                                onContinue={goToSchedule}
                            />
                        ) : null}

                        {step === 'schedule' ? (
                            <div className="grid gap-5">
                                <div className="grid gap-1">
                                    <h2
                                        id="step-heading"
                                        className="text-2xl font-semibold tracking-tight"
                                    >
                                        Pick a start time
                                    </h2>
                                    <p className="max-w-[66ch] text-sm text-muted-foreground">
                                        Times are Philippine time. Book at least{' '}
                                        {formatMinutes(policy.minNoticeMinutes)}{' '}
                                        ahead, and up to {policy.horizonDays}{' '}
                                        days out.
                                    </p>
                                </div>
                                <ExactStartTimeSelector
                                    dates={dates}
                                    selectedDate={date}
                                    onDateChange={changeDate}
                                    status={online ? status : 'offline'}
                                    availability={availability}
                                    selectedStart={startAt}
                                    onSelect={setStartAt}
                                    nextAvailable={nextAvailable}
                                    nextKnown={nextKnown}
                                    onNextAvailable={jumpToNext}
                                    onRetry={retry}
                                    timezone={branch.timezone}
                                    phone={branch.phone}
                                />
                                {startAt ? (
                                    <p className="rounded-xl border bg-card p-4 text-sm tabular-nums">
                                        <span className="text-muted-foreground">
                                            Selected time{' '}
                                        </span>
                                        <span className="font-semibold">
                                            {formatDayAndTime(
                                                startAt,
                                                branch.timezone,
                                            )}
                                        </span>
                                    </p>
                                ) : null}
                                {holdError ? (
                                    <Alert className={ALERT_TONES.error}>
                                        <AlertDescription>
                                            <p>{holdError}</p>
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                <div className="flex flex-wrap items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="max-sm:h-11"
                                        onClick={() => setStep('service')}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="button"
                                        className="max-sm:h-11"
                                        disabled={!startAt || hold.processing}
                                        aria-busy={hold.processing}
                                        onClick={reserve}
                                    >
                                        {hold.processing ? (
                                            <Spinner
                                                role="presentation"
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        {hold.processing
                                            ? 'Holding your time…'
                                            : 'Continue'}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                    </section>

                    <aside
                        aria-label="Booking summary"
                        className="lg:sticky lg:top-6"
                    >
                        <BookingSummaryCard
                            vehicleName={vehicle?.name}
                            serviceName={service?.name}
                            addOns={chosenAddOns}
                            totalCentavos={totalCentavos}
                            durationMinutes={durationMinutes}
                            bufferMinutes={service?.bufferMinutes ?? null}
                            startAt={startAt}
                            timezone={branch.timezone}
                        />
                    </aside>
                </div>
            </div>
        </>
    );
}

function VehicleStep({
    catalog,
    vehicleId,
    onChoose,
    onContinue,
    shopUrl,
}: {
    catalog: WizardPageProps['catalog'];
    vehicleId: number | null;
    onChoose: (id: number) => void;
    onContinue: () => void;
    shopUrl: string;
}) {
    return (
        <fieldset className="grid gap-3">
            <legend
                id="step-heading"
                className="mb-1 text-2xl font-semibold tracking-tight"
            >
                Choose your vehicle
            </legend>
            {catalog.length === 0 ? (
                <Alert className={ALERT_TONES.info}>
                    <AlertDescription>
                        <p>
                            Online booking has no vehicles on offer right now.
                        </p>
                    </AlertDescription>
                </Alert>
            ) : null}
            {catalog.map((vehicle) => (
                <ChoiceCard
                    key={vehicle.id}
                    type="radio"
                    name="vehicle"
                    checked={vehicleId === vehicle.id}
                    onChange={() => onChoose(vehicle.id)}
                >
                    <span className="text-lg font-semibold">
                        {vehicle.name}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {vehicle.services.length}{' '}
                        {vehicle.services.length === 1 ? 'service' : 'services'}
                    </span>
                </ChoiceCard>
            ))}
            <div className="flex flex-wrap items-center gap-3">
                <Link
                    href={shopUrl}
                    className={cn(
                        buttonVariants({ variant: 'outline' }),
                        'max-sm:h-11',
                    )}
                >
                    Back to shop
                </Link>
                <Button
                    type="button"
                    className="max-sm:h-11"
                    disabled={vehicleId === null}
                    onClick={onContinue}
                >
                    Continue
                </Button>
            </div>
        </fieldset>
    );
}

function ServiceStep({
    vehicleName,
    services,
    serviceId,
    addOnIds,
    onChoose,
    onToggleAddOn,
    onBack,
    onContinue,
}: {
    vehicleName: string;
    services: WizardPageProps['catalog'][number]['services'];
    serviceId: number | null;
    addOnIds: number[];
    onChoose: (id: number) => void;
    onToggleAddOn: (id: number, checked: boolean) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const service = services.find((entry) => entry.id === serviceId) ?? null;

    return (
        <div className="grid gap-5">
            <fieldset className="grid gap-3">
                <legend
                    id="step-heading"
                    className="mb-1 text-2xl font-semibold tracking-tight"
                >
                    Choose a service for your {vehicleName}
                </legend>
                {services.map((entry) => (
                    <ChoiceCard
                        key={entry.id}
                        type="radio"
                        name="service"
                        checked={serviceId === entry.id}
                        onChange={() => onChoose(entry.id)}
                    >
                        <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-lg font-semibold">
                                {entry.name}
                            </span>
                            <span className="font-semibold tabular-nums">
                                {formatCentavos(entry.priceCentavos)}
                            </span>
                        </span>
                        {entry.description ? (
                            <span className="max-w-[66ch] text-sm text-muted-foreground">
                                {entry.description}
                            </span>
                        ) : null}
                        <span className="text-sm text-muted-foreground tabular-nums">
                            {formatMinutes(entry.durationMinutes)}
                            {entry.bufferMinutes
                                ? ` service + ${formatMinutes(entry.bufferMinutes)} buffer`
                                : ''}
                        </span>
                    </ChoiceCard>
                ))}
            </fieldset>

            {service && service.addOns.length > 0 ? (
                <fieldset className="grid gap-3">
                    <legend className="mb-1 text-lg font-semibold">
                        Add-ons
                    </legend>
                    {service.addOns.map((addOn) => (
                        <ChoiceCard
                            key={addOn.id}
                            type="checkbox"
                            name="addOns"
                            checked={addOnIds.includes(addOn.id)}
                            onChange={(event) =>
                                onToggleAddOn(addOn.id, event.target.checked)
                            }
                        >
                            <span className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-semibold">
                                    {addOn.name}
                                </span>
                                <span className="font-semibold tabular-nums">
                                    +{formatCentavos(addOn.priceCentavos)}
                                </span>
                            </span>
                            {addOn.durationMinutes > 0 ? (
                                <span className="text-sm text-muted-foreground tabular-nums">
                                    Adds {formatMinutes(addOn.durationMinutes)}
                                </span>
                            ) : null}
                        </ChoiceCard>
                    ))}
                </fieldset>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    className="max-sm:h-11"
                    onClick={onBack}
                >
                    Back
                </Button>
                <Button
                    type="button"
                    className="max-sm:h-11"
                    disabled={serviceId === null}
                    onClick={onContinue}
                >
                    Continue
                </Button>
            </div>
        </div>
    );
}
