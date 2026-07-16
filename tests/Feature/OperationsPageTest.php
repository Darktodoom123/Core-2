<?php

use Inertia\Testing\AssertableInertia as Assert;

it('serves the Core Transaction 2 operations prototype', function () {
    $this->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('operations')
        );
});

