<?php

use App\Modules\Tenancy\Actions\StoreMedia;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\Support\Images;
use Tests\Support\Tenant;

beforeEach(function () {
    config(['rinquo.media_disk' => 'media-test']);
    Storage::fake('media-test');
});

function png(int $width = 400, int $height = 400): UploadedFile
{
    return UploadedFile::fake()->createWithContent('image.png', Images::png($width, $height));
}

function upload(array $overrides = []): array
{
    $overrides = array_map(fn ($value) => $value instanceof Closure ? $value() : $value, $overrides);

    return array_merge(['kind' => 'logo', 'alt_text' => 'Shine logo', 'file' => png()], $overrides);
}

test('an owner uploads media to a random private key and it is audited', function () {
    [$owner, $organization] = Tenant::organization('shine');

    $this->actingAs($owner)->post(route('owner.settings.media.store', $organization), upload())->assertSessionHasNoErrors();

    $media = OrganizationMedia::query()->sole();
    expect($media->storage_key)->toStartWith("organizations/{$organization->id}/media/")->not->toContain('logo')
        ->and($media->mime_type)->toBe('image/png');
    Storage::disk('media-test')->assertExists($media->storage_key);
    expect(AuditEvent::query()->where('action', 'media.created')->count())->toBe(1)
        ->and(json_encode($media->toArray()))->not->toContain($media->storage_key);
});

test('invalid uploads are rejected before anything is stored', function (array $override, string $field) {
    [$owner, $organization] = Tenant::organization('shine');

    $this->actingAs($owner)->post(route('owner.settings.media.store', $organization), upload($override))->assertSessionHasErrors($field);

    expect(OrganizationMedia::query()->count())->toBe(0)->and(Storage::disk('media-test')->allFiles())->toBe([]);
})->with([
    'not an image' => [['file' => fn () => UploadedFile::fake()->createWithContent('x.png', '<?php echo 1;')], 'file'],
    'svg' => [['file' => fn () => UploadedFile::fake()->createWithContent('x.svg', '<svg xmlns="http://www.w3.org/2000/svg"></svg>')], 'file'],
    'too small' => [['file' => fn () => png(50, 50)], 'file'],
    'too large file' => [['file' => fn () => png(400, 400)->size(6000)], 'file'],
    'bad kind' => [['kind' => 'banner'], 'kind'],
    'no alt text' => [['alt_text' => ''], 'alt_text'],
]);

test('replacing a logo archives the old row and removes its object only afterwards', function () {
    [$owner, $organization] = Tenant::organization('shine');
    $this->actingAs($owner);

    $this->post(route('owner.settings.media.store', $organization), upload());
    $first = OrganizationMedia::query()->sole();
    $this->post(route('owner.settings.media.store', $organization), upload());

    expect(OrganizationMedia::query()->active()->count())->toBe(1)->and(OrganizationMedia::query()->count())->toBe(2)
        ->and($first->fresh()->archived_at)->not->toBeNull();
    Storage::disk('media-test')->assertMissing($first->storage_key);
    expect(Storage::disk('media-test')->allFiles())->toHaveCount(1);
});

test('a failed transaction deletes the freshly stored object so nothing is orphaned', function () {
    [$owner, $organization] = Tenant::organization('shine');
    Event::listen('eloquent.creating: '.OrganizationMedia::class, fn () => throw new RuntimeException('db down'));

    try {
        app(StoreMedia::class)->handle($organization, $owner, png(), 'logo', 'Logo');
    } catch (RuntimeException) {
    }

    expect(Storage::disk('media-test')->allFiles())->toBe([])->and(OrganizationMedia::query()->count())->toBe(0);
});

test('the gallery is capped', function () {
    [$owner, $organization] = Tenant::organization('shine');
    $this->actingAs($owner);

    foreach (range(1, StoreMedia::GALLERY_LIMIT) as $ignored) {
        $this->post(route('owner.settings.media.store', $organization), upload(['kind' => 'gallery']))->assertSessionHasNoErrors();
    }
    $this->post(route('owner.settings.media.store', $organization), upload(['kind' => 'gallery']))->assertSessionHasErrors('file');

    expect(Storage::disk('media-test')->allFiles())->toHaveCount(StoreMedia::GALLERY_LIMIT);
});

test('archiving media removes the object and is audited', function () {
    [$owner, $organization] = Tenant::organization('shine');
    $this->actingAs($owner)->post(route('owner.settings.media.store', $organization), upload());
    $media = OrganizationMedia::query()->sole();

    $this->post(route('owner.settings.media.archive', [$organization, $media]))->assertSessionHasNoErrors();

    Storage::disk('media-test')->assertMissing($media->storage_key);
    expect($media->fresh()->archived_at)->not->toBeNull()->and(AuditEvent::query()->where('action', 'media.archived')->count())->toBe(1);
});

test('public media is served only for a visible shop and only to its own organization', function () {
    [$owner, $organization] = Tenant::organization('shine');
    Tenant::makeReady($organization);
    $this->actingAs($owner)->post(route('owner.settings.media.store', $organization), upload());
    $media = OrganizationMedia::query()->sole();
    [, $rival] = Tenant::organization('rival');
    Tenant::makeReady($rival);
    $rival->forceFill(['published_at' => now()])->save();
    auth()->logout();

    // Draft shop: not public.
    $this->get(route('shops.media', ['shine', $media->id]))->assertNotFound();

    $organization->forceFill(['published_at' => now()])->save();
    $this->get(route('shops.media', ['shine', $media->id]))->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');

    // Another published tenant cannot serve this tenant's media id.
    $this->get(route('shops.media', ['rival', $media->id]))->assertNotFound();
    // An archived object is gone.
    $media->forceFill(['archived_at' => now()])->save();
    $this->get(route('shops.media', ['shine', $media->id]))->assertNotFound();
});

test('owner media preview is authorized per organization', function () {
    [$owner, $organization] = Tenant::organization('shine');
    [$rival] = Tenant::organization('rival');
    $this->actingAs($owner)->post(route('owner.settings.media.store', $organization), upload());
    $media = OrganizationMedia::query()->sole();

    $this->get(route('owner.settings.media.show', [$organization, $media]))->assertOk();
    $this->actingAs($rival)->get(route('owner.settings.media.show', [$organization, $media]))->assertNotFound();
});
