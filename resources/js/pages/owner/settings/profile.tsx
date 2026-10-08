import { ConfigForm } from '@/components/owner/config-form';
import type { ConfigField, ConfigGroup } from '@/components/owner/config-form';
import { MediaManager } from '@/components/owner/media-manager';
import type { MediaItem } from '@/components/owner/media-manager';
import { SectionCard } from '@/components/owner/section-card';
import { SettingsPageHeader } from '@/components/owner/settings-page-header';
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
        wide: true,
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

const GROUPS: ConfigGroup[] = [
    {
        title: 'Public profile',
        description:
            'This information controls your tenant-facing public shop identity.',
        fields: ['name', 'shop_url', 'tagline', 'brand_color', 'description'],
    },
    {
        title: 'Branch information',
        description:
            'One active branch in the MVP. This is context, not a branch selector.',
        fields: [
            'branch_name',
            'address_line',
            'city',
            'phone',
            'branch_timezone',
        ],
    },
];

export default function Profile({
    organization,
    profile,
    branch,
    media,
    galleryLimit,
}: Props) {
    const fields: ConfigField[] = [
        ...FIELDS,
        {
            kind: 'static',
            name: 'shop_url',
            label: 'Public shop URL',
            value: `/shops/${profile.slug}`,
        },
        {
            kind: 'static',
            name: 'branch_timezone',
            label: 'Timezone',
            value: branch.timezone,
        },
    ];

    return (
        <div className="grid gap-6">
            <SettingsPageHeader section="profile" />
            <ConfigForm
                method="patch"
                url={`${organization.baseUrl}/profile`}
                title="Public profile and branch"
                submitLabel="Save profile"
                fields={fields}
                groups={GROUPS}
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
            <SectionCard
                title="Media"
                description="Upload a business logo and optional shop photos. Missing photos never block publishing."
            >
                <MediaManager
                    baseUrl={organization.baseUrl}
                    media={media}
                    galleryLimit={galleryLimit}
                />
            </SectionCard>
        </div>
    );
}
