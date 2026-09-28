<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

beforeEach(function (): void {
    Route::get('/__trusted-proxy-probe', fn (Request $request) => response()->json([
        'secure' => $request->isSecure(),
        'url' => url('/dashboard'),
        'ip' => $request->ip(),
    ]));
});

it('honours forwarded HTTPS from a private-network proxy', function (): void {
    $response = $this->withServerVariables(['REMOTE_ADDR' => '10.0.4.7'])
        ->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-Port' => '443',
            'X-Forwarded-For' => '203.0.113.9',
        ])
        ->get('http://core-2.example.test/__trusted-proxy-probe');

    $response->assertOk()
        ->assertJson([
            'secure' => true,
            'url' => 'https://core-2.example.test/dashboard',
            'ip' => '203.0.113.9',
        ]);
});

it('ignores forwarded headers from a public address', function (): void {
    $response = $this->withServerVariables(['REMOTE_ADDR' => '198.51.100.20'])
        ->withHeaders([
            'X-Forwarded-Proto' => 'https',
            'X-Forwarded-For' => '203.0.113.9',
        ])
        ->get('http://core-2.example.test/__trusted-proxy-probe');

    $response->assertOk()
        ->assertJson([
            'secure' => false,
            'ip' => '198.51.100.20',
        ]);
});

it('does not let a client spoof its address through the trusted proxy', function (): void {
    $response = $this->withServerVariables(['REMOTE_ADDR' => '10.0.4.7'])
        ->withHeaders(['X-Forwarded-For' => '1.2.3.4, 203.0.113.9'])
        ->get('/__trusted-proxy-probe');

    $response->assertOk()->assertJson(['ip' => '203.0.113.9']);
});
