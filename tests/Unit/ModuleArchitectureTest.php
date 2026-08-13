<?php

use App\Modules\Dispatch\Models\DispatchJob;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

uses(TestCase::class);

test('modular code does not depend on the retired type-first application namespaces', function (): void {
    $retiredNamespaces = [
        'App\\Actions\\',
        'App\\Models\\',
        'App\\Enums\\',
        'App\\Policies\\',
        'App\\Services\\',
        'App\\ViewModels\\',
        'App\\Console\\',
        'App\\Events\\',
        'App\\Exceptions\\',
        'App\\Http\\Middleware\\',
        'App\\Http\\Requests\\',
        'App\\Http\\Resources\\',
    ];

    $files = collect([
        app_path('Modules'),
        app_path('Platform'),
        app_path('Shared'),
    ])->filter(fn (string $path): bool => is_dir($path))
        ->flatMap(fn (string $path) => iterator_to_array(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($path))))
        ->filter(fn (SplFileInfo $file): bool => $file->isFile() && $file->getExtension() === 'php');

    foreach ($files as $file) {
        $contents = file_get_contents($file->getPathname());

        foreach ($retiredNamespaces as $namespace) {
            expect($contents)->not->toMatch('/^use\s+'.preg_quote($namespace, '/').'/m');
        }
    }
});

test('tracking registers its scheduled command from its owning platform provider', function (): void {
    expect(Artisan::all())->toHaveKey('location:prune');
});

test('legacy polymorphic type names resolve to the modular model classes', function (): void {
    expect((new DispatchJob)->getMorphClass())
        ->toBe('App\\Models\\DispatchJob');

    expect(Relation::getMorphedModel('App\\Models\\DispatchJob'))
        ->toBe(DispatchJob::class);
});

test('Rental and Sales keep the Shared asset usage boundary one directional', function (): void {
    $rentalFiles = collect(iterator_to_array(new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/Rental')))))
        ->filter(fn (SplFileInfo $file): bool => $file->isFile() && $file->getExtension() === 'php');
    $salesFiles = collect(iterator_to_array(new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules/Sales')))))
        ->filter(fn (SplFileInfo $file): bool => $file->isFile() && $file->getExtension() === 'php');

    foreach ($rentalFiles as $file) {
        $contents = file_get_contents($file->getPathname());
        expect($contents)->not->toContain('App\\Modules\\Sales\\')
            ->and($contents)->not->toMatch('/sales_[a-z0-9_]+/i');
    }

    foreach ($salesFiles as $file) {
        $contents = file_get_contents($file->getPathname());
        expect($contents)->not->toContain('App\\Modules\\Rental\\')
            ->and($contents)->not->toMatch('/rental_[a-z0-9_]+/i');
    }
});

test('Shared Assets does not import product module models and checkers remain owner-local', function (): void {
    $sharedFiles = collect(iterator_to_array(new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Shared/Assets')))))
        ->filter(fn (SplFileInfo $file): bool => $file->isFile() && $file->getExtension() === 'php');

    foreach ($sharedFiles as $file) {
        $contents = file_get_contents($file->getPathname());
        expect($contents)->not->toMatch('/^use\\s+App\\\\Modules\\\\(?:Rental|Sales|Assignment|Dispatch)\\\\.*Models\\\\/m');
    }

    $checkerFiles = collect(iterator_to_array(new RecursiveIteratorIterator(new RecursiveDirectoryIterator(app_path('Modules')))))
        ->filter(fn (SplFileInfo $file): bool => $file->isFile() && str_ends_with($file->getFilename(), 'AssetUsageConflictChecker.php'));
    $allowed = array_map(static fn (string $path): string => str_replace('/', DIRECTORY_SEPARATOR, $path), [
        app_path('Modules/Rental/Services/RentalAssetUsageConflictChecker.php'),
        app_path('Modules/Sales/Services/SalesAssetUsageConflictChecker.php'),
        app_path('Modules/Assignment/Services/DispatchAssetUsageConflictChecker.php'),
    ]);

    expect($checkerFiles->map(fn (SplFileInfo $file): string => $file->getPathname())->values()->all())->toEqualCanonicalizing($allowed);
});

test('all tagged asset usage checkers and their providers are registered', function (): void {
    $providers = file_get_contents(base_path('bootstrap/providers.php'));

    expect($providers)->toContain('RentalServiceProvider::class')
        ->and($providers)->toContain('SalesServiceProvider::class')
        ->and($providers)->toContain('AssignmentServiceProvider::class');

    expect(app()->make(OperationalAssetAvailability::class))->toBeInstanceOf(OperationalAssetAvailability::class);
});
