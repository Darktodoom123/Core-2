<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

it('serves the authenticated operations workspace', function () {
    $this->actingAs(User::factory()->create())->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspace')
            ->has('jobs')
            ->has('assets')
            ->has('fuelRequests')
        );
});
