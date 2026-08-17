<?php

use Illuminate\Support\Facades\Config;
use Tests\TestCase;

uses(TestCase::class);

test('pgsql connection configuration contains driver, search path, and options definitions', function () {
    $pgsql = Config::get('database.connections.pgsql');

    expect($pgsql)->toBeArray()
        ->and($pgsql['driver'])->toBe('pgsql')
        ->and($pgsql['search_path'])->toBe('public')
        ->and(array_key_exists('options', $pgsql))->toBeTrue();
});

test('pgsql_direct connection configuration is available for administrative and migration tasks', function () {
    $direct = Config::get('database.connections.pgsql_direct');

    expect($direct)->toBeArray()
        ->and($direct['driver'])->toBe('pgsql')
        ->and($direct['port'])->toBe('5432')
        ->and($direct['search_path'])->toBe('public');
});
