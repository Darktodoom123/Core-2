<?php

use App\Modules\Dispatch\Models\DispatchJob;
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
