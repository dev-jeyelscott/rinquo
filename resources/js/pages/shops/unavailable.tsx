import { Head } from '@inertiajs/react';

/** Generic page for draft, unknown and no-longer-ready shops. It carries no tenant data. */
export default function Unavailable() {
    return (
        <>
            <Head title="Shop unavailable" />
            <section
                aria-labelledby="unavailable-heading"
                className="mx-auto grid max-w-md gap-2 py-16 text-center"
            >
                <h1 id="unavailable-heading" className="text-2xl font-semibold">
                    This page is not available
                </h1>
                <p className="text-muted-foreground">
                    The shop you are looking for is not open for online booking
                    right now. Please check the link or try again later.
                </p>
            </section>
        </>
    );
}
