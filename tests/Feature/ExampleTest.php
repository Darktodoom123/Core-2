<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('returns a successful response', function () {
    $response = $this->actingAs(User::factory()->create())->get(route('home'));

    $response->assertOk();
});
