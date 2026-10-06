import { Head, Link, router } from '@inertiajs/react';
import { FormEvent, useState } from 'react';
import CustomerShell from '@/layouts/customer-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
type Shop = { name: string; city: string | null; url: string };
export default function Directory({
    query,
    shops,
}: {
    query: string;
    shops: Shop[];
}) {
    const [value, setValue] = useState(query);
    function submit(e: FormEvent) {
        e.preventDefault();
        router.get('/account/directory', value ? { q: value } : {}, {
            preserveState: true,
        });
    }
    return (
        <CustomerShell>
            <Head title="Find a shop" />
            <section className="grid gap-5">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Find a shop
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                        Search Rinquo businesses by name or city.
                    </p>
                </div>
                <form onSubmit={submit} className="flex gap-2">
                    <Input
                        aria-label="Search businesses by name or city"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Business name or city"
                    />
                    <Button type="submit">Search</Button>
                </form>
                {shops.length ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {shops.map((shop) => (
                            <Card key={shop.url}>
                                <CardHeader>
                                    <CardTitle className="text-base">
                                        {shop.name}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="flex items-center justify-between gap-4 text-sm">
                                    <span className="text-muted-foreground">
                                        {shop.city ?? 'Location unavailable'}
                                    </span>
                                    <Button asChild variant="outline">
                                        <Link href={shop.url}>View shop</Link>
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-8 text-sm text-muted-foreground">
                            No directory shops match this search. Try another
                            name or city.
                        </CardContent>
                    </Card>
                )}
            </section>
        </CustomerShell>
    );
}
