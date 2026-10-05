import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import { ConfirmAction } from '@/components/owner/confirm-action';
import { SelectField, TextField } from '@/components/owner/form-field';
import { Button } from '@/components/ui/button';

export type MediaItem = {
    id: number;
    kind: 'logo' | 'hero' | 'gallery';
    altText: string;
    url: string;
};

const KINDS = [
    { value: 'logo', label: 'Logo (replaces the current logo)' },
    { value: 'hero', label: 'Hero photo (replaces the current hero)' },
    { value: 'gallery', label: 'Gallery photo' },
];

type Props = { baseUrl: string; media: MediaItem[]; galleryLimit: number };

/** Upload and archive tenant media. Photos are optional; the shop has a fallback. */
export function MediaManager({ baseUrl, media, galleryLimit }: Props) {
    const form = useForm<{ kind: string; alt_text: string; file: File | null }>(
        {
            kind: 'logo',
            alt_text: '',
            file: null,
        },
    );

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        form.post(`${baseUrl}/media`, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    }

    return (
        <div className="grid gap-6">
            <form
                onSubmit={submit}
                aria-label="Upload a photo"
                noValidate
                className="grid gap-3 sm:grid-cols-2"
            >
                <SelectField
                    label="Photo type"
                    options={KINDS}
                    value={form.data.kind}
                    onChange={(event) =>
                        form.setData('kind', event.target.value)
                    }
                    error={form.errors.kind}
                />
                <TextField
                    label="Describe the photo"
                    required
                    maxLength={160}
                    hint="Read aloud by screen readers when the photo shows."
                    value={form.data.alt_text}
                    onChange={(event) =>
                        form.setData('alt_text', event.target.value)
                    }
                    error={form.errors.alt_text}
                />
                <TextField
                    label="Image file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required
                    hint="JPEG, PNG or WebP, at least 200 px, up to 5 MB."
                    onChange={(event) =>
                        form.setData('file', event.target.files?.[0] ?? null)
                    }
                    error={form.errors.file}
                    className="sm:col-span-2"
                />
                <div className="sm:col-span-2">
                    <Button
                        type="submit"
                        disabled={form.processing || form.data.file === null}
                        aria-busy={form.processing}
                    >
                        {form.processing ? 'Uploading...' : 'Upload photo'}
                    </Button>
                </div>
            </form>
            {media.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    No photos yet. Your page shows a neutral placeholder
                    instead.
                </p>
            ) : (
                <ul aria-label="Photos" className="grid gap-3 sm:grid-cols-2">
                    {media.map((item) => (
                        <li
                            key={item.id}
                            className="flex items-center gap-3 rounded-xl border bg-card p-3"
                        >
                            <img
                                src={item.url}
                                alt={item.altText}
                                className="size-16 rounded-md object-cover"
                            />
                            <div className="grid flex-1 gap-0.5 text-sm">
                                <span className="font-medium capitalize">
                                    {item.kind}
                                </span>
                                <span className="text-muted-foreground">
                                    {item.altText}
                                </span>
                            </div>
                            <ConfirmAction
                                label="Remove"
                                ariaLabel={`Remove ${item.kind} photo ${item.altText}`}
                                title="Remove this photo?"
                                description={`The ${item.kind} photo is archived and no longer shown. Up to ${galleryLimit} gallery photos are kept.`}
                                confirmLabel="Remove photo"
                                url={`${baseUrl}/media/${item.id}/archive`}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
