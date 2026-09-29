<?php

$roadGoing = ['registrations', 'insurance', 'emission_certs'];
$lifting = ['load_test_certs'];

return [
    // Permit categories each asset kind must keep valid for the whole dispatch window.
    // Road transit permits are trip-specific, so they are not required by default.
    'required_permits' => [
        'truck' => $roadGoing,
        'vehicle' => $roadGoing,
        'crane' => [...$roadGoing, ...$lifting],
        'mobile_crane' => [...$roadGoing, ...$lifting],
        'tower_crane' => ['insurance', ...$lifting],
        'equipment' => ['insurance'],
    ],

    // Expired or revoked permits always block dispatch. Missing permits block only
    // once records have been uploaded and this is switched on.
    'block_missing_permits' => (bool) env('FLEET_BLOCK_MISSING_PERMITS', false),

    // Days before expiry that the Fleet screen starts flagging a permit for renewal.
    'permit_warning_days' => 30,
];
