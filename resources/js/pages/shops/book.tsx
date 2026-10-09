import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowRightIcon,
    CarFrontIcon,
    CheckIcon,
    PlusIcon,
    SparklesIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Ref } from 'react';
import { BookingActionBar } from '@/components/booking/booking-action-bar';
import { BookingJourneyHeader } from '@/components/booking/booking-journey-header';
import {
    BookingSummaryCard,
    BookingSummaryCompact,
    vehicleLabel,
} from '@/components/booking/booking-summary-card';
import { ChoiceCard } from '@/components/booking/choice-card';
import { ExactStartTimeSelector } from '@/components/booking/exact-start-time-selector';
import type { SelectorStatus } from '@/components/booking/exact-start-time-selector';
import { TextField } from '@/components/owner/form-field';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useFocusOnChange } from '@/hooks/use-focus-on-change';
import { useOnline } from '@/hooks/use-online';
import { formatDayAndTime, localDateOf, uuid } from '@/lib/booking-format';
import { formatCentavos } from '@/lib/money';
import { formatMinutes } from '@/lib/schedule';
import { ALERT_TONES } from '@/lib/tones';
import type { SavedVehicle, WizardPageProps } from '@/types/booking';

type Step = 'vehicle' | 'service' | 'schedule';

/**
 * The booking wizard: Vehicle (type, make and model), Service and add-ons, then
 * Schedule. The selection lives in the query string so availability and the
 * next available start load as partial reloads; the make and model never
 * travel in a URL. Continue on Schedule places the hold. The server stays
 * authoritative: a time shown here can be taken by the time the customer
 * continues, which is a normal outcome with its own message.
 */
export default function Book({
    shop,
    branch,
    catalog,
    dates,
    policy,
    selection,
    savedVehicles,
    availability = null,
    nextAvailable = null,
    urls,
}: WizardPageProps) {
    const online = useOnline();
    const [vehicleId, setVehicleId] = useState(selection.vehicle);
    const [serviceId, setServiceId] = useState(selection.service);
    const [addOnIds, setAddOnIds] = useState<number[]>(selection.addOns);
    const [makeModel, setMakeModel] = useState(selection.makeModel ?? '');
    const [savedVehicleId, setSavedVehicleId] = useState<number | null>(null);
    const [date, setDate] = useState(selection.date);
    const [startAt, setStartAt] = useState<string | null>(null);
    // The make and model never travel in the URL, so a reload or deep link without one resumes at Vehicle.
    const [step, setStep] = useState<Step>(
        !selection.makeModel
            ? 'vehicle'
            : selection.vehicle && selection.service
              ? 'schedule'
              : selection.vehicle
                ? 'service'
                : 'vehicle',
    );
    const stepHeading = useFocusOnChange<HTMLHeadingElement>(step);
    const holdAlert = useRef<HTMLDivElement>(null);
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
        makeModel.trim(),
        savedVehicleId,
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
        vehicle_make_model: '',
        customer_vehicle_id: null as number | null,
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

    function chooseSavedVehicle(saved: SavedVehicle) {
        setSavedVehicleId(saved.id);
        setMakeModel(saved.makeModel ?? '');
    }

    function typeMakeModel(value: string) {
        setMakeModel(value);

        // Typing a different vehicle is no longer the saved one; its plate must not ride along.
        const saved = savedVehicles.find(
            (entry) => entry.id === savedVehicleId,
        );
        if (saved && saved.makeModel !== null && saved.makeModel !== value) {
            setSavedVehicleId(null);
        }
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
            vehicle_make_model: makeModel.trim(),
            customer_vehicle_id: savedVehicleId,
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
        hold.errors.add_on_ids ??
        hold.errors.vehicle_make_model ??
        hold.errors.customer_vehicle_id;
    // The error sits below the time grid, behind the fixed action bar: bring it into view and announce it.
    useEffect(() => {
        if (holdError) {
            holdAlert.current?.focus();
        }
    }, [holdError]);
    const summaryInput = {
        vehicleName: vehicle?.name,
        vehicleMakeModel: makeModel.trim() || null,
        serviceName: service?.name,
        addOns: chosenAddOns,
        totalCentavos,
        durationMinutes,
        startAt,
        timezone: branch.timezone,
    };

    return (
        <>
            <Head title={`Book at ${shop.name}`} />
            <div className="grid gap-6 pb-36 lg:pb-0">
                <BookingJourneyHeader
                    shopName={shop.name}
                    shopUrl={urls.shop}
                    title="Book an appointment"
                    step={step}
                />

                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
                    <section
                        aria-labelledby="step-heading"
                        className="grid gap-5 rounded-2xl border bg-card p-4 sm:p-7"
                    >
                        {step !== 'vehicle' ? (
                            <BookingSummaryCompact
                                {...summaryInput}
                                pendingHint={
                                    step === 'service'
                                        ? 'Select a start time next'
                                        : 'Choose an exact start time'
                                }
                            />
                        ) : null}

                        {step === 'vehicle' ? (
                            <VehicleStep
                                catalog={catalog}
                                vehicleId={vehicleId}
                                onChoose={chooseVehicle}
                                makeModel={makeModel}
                                onMakeModel={typeMakeModel}
                                savedVehicles={savedVehicles}
                                savedVehicleId={savedVehicleId}
                                onSavedVehicle={chooseSavedVehicle}
                                headingRef={stepHeading}
                            />
                        ) : null}

                        {step === 'service' && vehicle ? (
                            <ServiceStep
                                vehicleName={vehicleLabel(
                                    vehicle.name,
                                    makeModel.trim(),
                                )}
                                services={vehicle.services}
                                serviceId={serviceId}
                                addOnIds={addOnIds}
                                onChoose={chooseService}
                                onToggleAddOn={toggleAddOn}
                                headingRef={stepHeading}
                            />
                        ) : null}

                        {step === 'schedule' ? (
                            <div className="grid gap-5">
                                <div className="grid gap-1">
                                    <h2
                                        id="step-heading"
                                        ref={stepHeading}
                                        tabIndex={-1}
                                        className="text-2xl font-semibold tracking-tight outline-none"
                                    >
                                        Find your preferred time
                                    </h2>
                                    <p className="max-w-[66ch] text-sm text-muted-foreground">
                                        Choose an exact service start time. The
                                        shop will take care of the rest. Times
                                        are Philippine time; book at least{' '}
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
                                <p className="text-xs text-muted-foreground">
                                    Unavailable times are disabled. All times
                                    are Philippine time.
                                </p>
                                {startAt ? (
                                    <p className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm tabular-nums">
                                        <CheckIcon
                                            aria-hidden="true"
                                            className="mt-0.5 size-4 shrink-0 text-primary"
                                        />
                                        <span className="grid gap-0.5">
                                            <span>
                                                <span className="text-muted-foreground">
                                                    Selected time{' '}
                                                </span>
                                                <span className="font-semibold text-primary">
                                                    {formatDayAndTime(
                                                        startAt,
                                                        branch.timezone,
                                                    )}
                                                </span>
                                            </span>
                                            <span className="text-muted-foreground">
                                                Exact planned service start
                                            </span>
                                        </span>
                                    </p>
                                ) : null}
                                {holdError ? (
                                    <div
                                        ref={holdAlert}
                                        tabIndex={-1}
                                        className="outline-none"
                                    >
                                        <Alert className={ALERT_TONES.error}>
                                            <AlertDescription>
                                                <p>{holdError}</p>
                                                {hold.errors
                                                    .vehicle_make_model ? (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="max-lg:min-h-11"
                                                        onClick={() =>
                                                            setStep('vehicle')
                                                        }
                                                    >
                                                        Enter vehicle details
                                                    </Button>
                                                ) : null}
                                            </AlertDescription>
                                        </Alert>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {step === 'vehicle' ? (
                            <BookingActionBar
                                back={{ href: urls.shop }}
                                meta="Step 1 of 5"
                            >
                                <Button
                                    type="button"
                                    disabled={
                                        vehicleId === null ||
                                        makeModel.trim() === ''
                                    }
                                    onClick={() => setStep('service')}
                                >
                                    Continue
                                    <ArrowRightIcon aria-hidden="true" />
                                </Button>
                            </BookingActionBar>
                        ) : null}
                        {step === 'service' ? (
                            <BookingActionBar
                                back={{ onClick: () => setStep('vehicle') }}
                                meta="Step 2 of 5"
                            >
                                <Button
                                    type="button"
                                    disabled={serviceId === null}
                                    onClick={goToSchedule}
                                >
                                    Continue
                                    <ArrowRightIcon aria-hidden="true" />
                                </Button>
                            </BookingActionBar>
                        ) : null}
                        {step === 'schedule' ? (
                            <BookingActionBar
                                back={{ onClick: () => setStep('service') }}
                                meta="Philippine time"
                            >
                                <Button
                                    type="button"
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
                                        : 'Hold this time & continue'}
                                    {hold.processing ? null : (
                                        <ArrowRightIcon aria-hidden="true" />
                                    )}
                                </Button>
                            </BookingActionBar>
                        ) : null}
                    </section>

                    <aside
                        aria-label="Booking summary"
                        className="lg:sticky lg:top-6"
                    >
                        <BookingSummaryCard {...summaryInput} />
                    </aside>
                </div>
            </div>
        </>
    );
}

/** Plate and label when present; the make/model prompt only for a legacy saved vehicle that has none. */
function savedDetail(saved: SavedVehicle): string | null {
    return (
        [saved.plate, saved.label].filter(Boolean).join(' · ') ||
        (saved.makeModel ? null : 'Enter its make and model below')
    );
}

function VehicleStep({
    catalog,
    vehicleId,
    onChoose,
    makeModel,
    onMakeModel,
    savedVehicles,
    savedVehicleId,
    onSavedVehicle,
    headingRef,
}: {
    headingRef: Ref<HTMLHeadingElement>;
    catalog: WizardPageProps['catalog'];
    vehicleId: number | null;
    onChoose: (id: number) => void;
    makeModel: string;
    onMakeModel: (value: string) => void;
    savedVehicles: SavedVehicle[];
    savedVehicleId: number | null;
    onSavedVehicle: (vehicle: SavedVehicle) => void;
}) {
    return (
        <div className="grid gap-6">
            <div className="grid gap-1">
                <h2
                    id="step-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-2xl font-semibold tracking-tight outline-none"
                >
                    What are you bringing in?
                </h2>
                <p className="text-sm text-muted-foreground">
                    Choose your vehicle type to see compatible services and
                    prices.
                </p>
            </div>
            <fieldset aria-labelledby="step-heading" className="grid gap-3">
                {catalog.length === 0 ? (
                    <Alert className={ALERT_TONES.info}>
                        <AlertDescription>
                            <p>
                                Online booking has no vehicles on offer right
                                now.
                            </p>
                        </AlertDescription>
                    </Alert>
                ) : null}
                {catalog.map((vehicle) => (
                    <ChoiceCard
                        key={vehicle.id}
                        type="radio"
                        name="vehicle"
                        icon={<CarFrontIcon className="size-5" />}
                        checked={vehicleId === vehicle.id}
                        onChange={() => onChoose(vehicle.id)}
                    >
                        <span className="font-semibold">{vehicle.name}</span>
                        <span className="text-sm text-muted-foreground">
                            {vehicle.services.length}{' '}
                            {vehicle.services.length === 1
                                ? 'service'
                                : 'services'}
                        </span>
                    </ChoiceCard>
                ))}
            </fieldset>

            <div className="grid gap-4 border-t pt-6">
                <div className="grid gap-1">
                    <h3 className="text-lg font-semibold">
                        Vehicle make and model
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Tell the shop which vehicle is coming.
                    </p>
                </div>
                {savedVehicles.length > 0 ? (
                    <fieldset className="grid gap-2">
                        <legend className="mb-1 text-sm font-medium">
                            Your saved vehicles
                        </legend>
                        {savedVehicles.map((saved) => (
                            <ChoiceCard
                                key={saved.id}
                                type="radio"
                                name="savedVehicle"
                                checked={savedVehicleId === saved.id}
                                onChange={() => onSavedVehicle(saved)}
                            >
                                <span className="font-semibold">
                                    {saved.makeModel ?? 'Saved vehicle'}
                                </span>
                                {savedDetail(saved) ? (
                                    <span className="text-sm text-muted-foreground">
                                        {savedDetail(saved)}
                                    </span>
                                ) : null}
                            </ChoiceCard>
                        ))}
                    </fieldset>
                ) : null}
                <TextField
                    controlClassName="border-booking-control"
                    label="Make / model"
                    name="vehicle_make_model"
                    autoComplete="off"
                    required
                    maxLength={120}
                    hint="Plate number is optional and can be added later."
                    value={makeModel}
                    onChange={(event) => onMakeModel(event.target.value)}
                />
            </div>
        </div>
    );
}

function ServiceStep({
    vehicleName,
    services,
    serviceId,
    addOnIds,
    onChoose,
    onToggleAddOn,
    headingRef,
}: {
    headingRef: Ref<HTMLHeadingElement>;
    vehicleName: string;
    services: WizardPageProps['catalog'][number]['services'];
    serviceId: number | null;
    addOnIds: number[];
    onChoose: (id: number) => void;
    onToggleAddOn: (id: number, checked: boolean) => void;
}) {
    const service = services.find((entry) => entry.id === serviceId) ?? null;

    return (
        <div className="grid gap-5">
            <p className="flex w-fit items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                <CheckIcon aria-hidden="true" className="size-3.5" />
                {vehicleName}
            </p>
            <div className="grid gap-1">
                <h2
                    id="step-heading"
                    ref={headingRef}
                    tabIndex={-1}
                    className="text-2xl font-semibold tracking-tight outline-none"
                >
                    Choose your service
                </h2>
                <p className="text-sm text-muted-foreground">
                    Prices and durations are matched to your selected vehicle.
                </p>
            </div>
            <fieldset aria-labelledby="step-heading" className="grid gap-3">
                {services.map((entry) => (
                    <ChoiceCard
                        key={entry.id}
                        type="radio"
                        name="service"
                        icon={<SparklesIcon className="size-5" />}
                        checked={serviceId === entry.id}
                        onChange={() => onChoose(entry.id)}
                        aside={
                            <>
                                <span className="font-semibold tabular-nums">
                                    {formatCentavos(entry.priceCentavos)}
                                </span>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                    {formatMinutes(entry.durationMinutes)}
                                </span>
                            </>
                        }
                    >
                        <span className="font-semibold">{entry.name}</span>
                        {entry.description ? (
                            <span className="max-w-[66ch] text-sm text-muted-foreground">
                                {entry.description}
                            </span>
                        ) : null}
                    </ChoiceCard>
                ))}
            </fieldset>

            {service && service.addOns.length > 0 ? (
                <fieldset className="grid gap-3">
                    <legend className="mb-1 text-lg font-semibold">
                        Add-ons{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                            (optional)
                        </span>
                    </legend>
                    {service.addOns.map((addOn) => (
                        <ChoiceCard
                            key={addOn.id}
                            type="checkbox"
                            name="addOns"
                            icon={<PlusIcon className="size-5" />}
                            checked={addOnIds.includes(addOn.id)}
                            onChange={(event) =>
                                onToggleAddOn(addOn.id, event.target.checked)
                            }
                            aside={
                                <>
                                    <span className="font-semibold tabular-nums">
                                        +{formatCentavos(addOn.priceCentavos)}
                                    </span>
                                    {addOn.durationMinutes > 0 ? (
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                            Adds{' '}
                                            {formatMinutes(
                                                addOn.durationMinutes,
                                            )}
                                        </span>
                                    ) : null}
                                </>
                            }
                        >
                            <span className="font-semibold">{addOn.name}</span>
                        </ChoiceCard>
                    ))}
                </fieldset>
            ) : null}
        </div>
    );
}
