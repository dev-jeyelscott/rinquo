<?php

/** @return list<array{path: string, status: string, approved: string}> */
function referenceRows(): array
{
    $rows = [];
    foreach (file(base_path('docs/reference-ui/README.md'), FILE_IGNORE_NEW_LINES) as $line) {
        if (preg_match('/^\|\s*`([^`]+\.png)`\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|$/', $line, $match)) {
            $rows[] = ['path' => $match[1], 'status' => $match[2], 'approved' => $match[3]];
        }
    }

    return $rows;
}

test('the canonical manifest registers exactly the 28 Spec 03 core references as Approved', function () {
    $spec03 = array_values(array_filter(referenceRows(), fn (array $row): bool => str_starts_with($row['path'], 'spec-03/')));

    expect($spec03)->toHaveCount(28)
        ->and(array_unique(array_column($spec03, 'path')))->toHaveCount(28);
    foreach ($spec03 as $row) {
        expect($row['status'])->toBe('Approved')
            ->and($row['approved'])->toBe('2026-10-09')
            ->and(base_path('docs/reference-ui/'.$row['path']))->toBeFile()
            ->and($row['path'])->toMatch('#^spec-03/(desktop|mobile)/(0[1-9]|1[0-4])-[a-z-]+\.png$#');
    }
    expect(count(array_filter($spec03, fn (array $row): bool => str_starts_with($row['path'], 'spec-03/desktop/'))))->toBe(14);
});

test('registering Spec 03 leaves every Spec 02 outcome reference approved and unsuperseded', function () {
    $spec02 = array_values(array_filter(referenceRows(), fn (array $row): bool => str_starts_with($row['path'], 'spec-02/')));

    expect($spec02)->toHaveCount(16);
    foreach ($spec02 as $row) {
        expect($row['status'])->toBe('Approved')->and($row['approved'])->toBe('2026-10-08');
    }
});
