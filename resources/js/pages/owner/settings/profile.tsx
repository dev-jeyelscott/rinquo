import { Head } from '@inertiajs/react';
import { ConfigForm } from '@/components/owner/config-form';
import type { ConfigField } from '@/components/owner/config-form';
import { MediaManager } from '@/components/owner/media-manager';
import type { MediaItem } from '@/components/owner/media-manager';
import { SectionCard } from '@/components/owner/section-card';
import type { OwnerPageProps } from '@/types/owner';

type Props = OwnerPageProps & {
    profile: {
        name: string;
        slug: string;
        tagline: string;
        description: string;
        brandColor: string;
    };
    branch: {
        name: string;
        addressLine: string;
        city: string;
        phone: string;
        timezone: string;
    };
    media: MediaItem[];
    galleryLimit: number;
};

const FIELDS: ConfigField[] = [
    {
        kind: 'text',
        name: 'name',
        label: 'Business name',
        required: true,
        maxLength: 120,
    },
    {
        kind: 'text',
        name: 'tagline',
        label: 'Tagline',
        required: true,
        maxLength: 160,
    },
    {
        kind: 'textarea',
        name: 'description',
        label: 'Description',
        required: true,
        maxLength: 2000,
    },
    {
        kind: 'text',
        name: 'brand_color',
        label: 'Brand color',
        required: true,
        maxLength: 7,
        hint: 'A hex color such as #1E40AF. Used for your page header and accents.',
    },
    {
        kind: 'text',
        name: 'branch_name',
        label: 'Branch name',
        required: true,
        maxLength: 120,
    },
    {
        kind: 'text',
        name: 'address_line',
        label: 'Street address',
        required: true,
        maxLength: 255,
    },
    {
        kind: 'text',
        name: 'city',
        label: 'City',
        required: true,
        maxLength: 120,
    },
    { kind: 'text', name: 'phone', label: 'Phone (optional)', maxLength: 40 },
];

export default function Profile({
    organization,
    profile,
    branch,
    media,
    galleryLimit,
}: Props) {
    return (
        <>
            <Head title="Profile" />
            <div className="grid items-start gap-6 xl:grid-cols-[3fr_2fr]">
                <SectionCard
                    title="Public profile and branch"
                    description={`Shop address: /shops/${profile.slug}. The branch uses the ${branch.timezone} timezone.`}
                >
                    <ConfigForm
                        method="patch"
                        url={`${organization.baseUrl}/profile`}
                        title="Public profile and branch"
                        submitLabel="Save profile"
                        fields={FIELDS}
                        initial={{
                            name: profile.name,
                            tagline: profile.tagline,
                            description: profile.description,
                            brand_color: profile.brandColor,
                            branch_name: branch.name,
                            address_line: branch.addressLine,
                            city: branch.city,
                            phone: branch.phone,
                        }}
                    />
                </SectionCard>
                <SectionCard
                    title="Logo and photos"
                    description="Optional. Missing photos never block publishing."
                >
                    <MediaManager
                        baseUrl={organization.baseUrl}
                        media={media}
                        galleryLimit={galleryLimit}
                    />
                </SectionCard>
            </div>
        </>
    );
}
