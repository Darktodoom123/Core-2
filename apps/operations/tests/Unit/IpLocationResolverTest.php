<?php

use App\Platform\Identity\Support\IpLocationResolver;
use Tests\TestCase;

uses(TestCase::class);

it('resolves loopback addresses to local machine label', function (string $ip): void {
    expect(IpLocationResolver::resolve($ip))->toBe('Local Machine (Loopback)');
    expect(IpLocationResolver::isLocalOrPrivate($ip))->toBeTrue();
})->with([
    '127.0.0.1',
    '127.0.1.10',
    '::1',
    'localhost',
]);

it('resolves private network addresses to local network label', function (string $ip): void {
    expect(IpLocationResolver::resolve($ip))->toBe('Local Network / Private IP');
    expect(IpLocationResolver::isLocalOrPrivate($ip))->toBeTrue();
})->with([
    '10.0.0.1',
    '10.254.10.50',
    '172.16.0.1',
    '172.24.5.10',
    '172.31.255.254',
    '192.168.1.1',
    '192.168.100.250',
]);

it('resolves link-local addresses to local link-local label', function (string $ip): void {
    expect(IpLocationResolver::resolve($ip))->toBe('Local Network / Link-Local');
    expect(IpLocationResolver::isLocalOrPrivate($ip))->toBeTrue();
})->with([
    '169.254.1.1',
    'fe80::1',
]);

it('handles unknown, empty, or invalid IP addresses gracefully', function (?string $ip): void {
    expect(IpLocationResolver::resolve($ip))->toBe('Unknown Location');
    expect(IpLocationResolver::isLocalOrPrivate($ip))->toBeFalse();
})->with([
    null,
    '',
    'Unknown IP',
    'invalid-ip',
    'not.an.ip',
    '999.999.999.999',
    'random-string-xyz',
]);

it('resolves IPv4-mapped IPv6 addresses correctly', function (): void {
    expect(IpLocationResolver::resolve('::ffff:127.0.0.1'))->toBe('Local Machine (Loopback)')
        ->and(IpLocationResolver::isLocalOrPrivate('::ffff:127.0.0.1'))->toBeTrue()
        ->and(IpLocationResolver::resolve('::ffff:192.168.1.1'))->toBe('Local Network / Private IP')
        ->and(IpLocationResolver::isLocalOrPrivate('::ffff:192.168.1.1'))->toBeTrue()
        ->and(IpLocationResolver::resolve('::ffff:8.8.8.8'))->toBe('Mountain View, United States')
        ->and(IpLocationResolver::isLocalOrPrivate('::ffff:8.8.8.8'))->toBeFalse();
});

it('resolves IPs with ports attached or comma-separated proxy chains', function (): void {
    expect(IpLocationResolver::resolve('192.168.1.1:8080'))->toBe('Local Network / Private IP')
        ->and(IpLocationResolver::resolve('[::1]:3000'))->toBe('Local Machine (Loopback)')
        ->and(IpLocationResolver::resolve('8.8.8.8:443'))->toBe('Mountain View, United States')
        ->and(IpLocationResolver::resolve('8.8.8.8, 10.0.0.1'))->toBe('Mountain View, United States')
        ->and(IpLocationResolver::resolve('10.0.0.1, 8.8.8.8'))->toBe('Local Network / Private IP');
});

it('resolves IPv6 unique local private addresses correctly', function (string $ip): void {
    expect(IpLocationResolver::resolve($ip))->toBe('Local Network / Private IP');
    expect(IpLocationResolver::isLocalOrPrivate($ip))->toBeTrue();
})->with([
    'fc00::1',
    'fd12:3456:789a:1::1',
]);

it('resolves well-known public anycast IPs to deterministic city and country', function (): void {
    expect(IpLocationResolver::resolve('8.8.8.8'))->toBe('Mountain View, United States')
        ->and(IpLocationResolver::resolve('1.1.1.1'))->toBe('Sydney, Australia')
        ->and(IpLocationResolver::isLocalOrPrivate('8.8.8.8'))->toBeFalse();
});

it('supports custom test overrides and clearing them', function (): void {
    IpLocationResolver::setOverride('198.51.100.42', 'Tokyo, Japan');
    expect(IpLocationResolver::resolve('198.51.100.42'))->toBe('Tokyo, Japan');

    IpLocationResolver::clearOverrides();
    expect(IpLocationResolver::resolve('198.51.100.42'))->not()->toBe('Tokyo, Japan');
});
