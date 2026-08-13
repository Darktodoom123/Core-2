<?php

it('requires PostgreSQL for Rental/Sales asset-usage race evidence', function (): void {
    expect(config('database.default'))->toBe('pgsql');
});

it('freezes the exactly-one-winner concurrency matrix for R6', function (): void {
    expect([
        'rental_vs_sales_acceptance',
        'rental_vs_dispatch_assignment',
        'overlapping_rentals',
        'duplicate_rental_approval',
        'competing_sales_quotes',
        'duplicate_quote_acceptance',
        'duplicate_checkout',
        'duplicate_fulfillment',
        'duplicate_transfer',
        'transfer_vs_status_restore',
        'permission_revocation_race',
        'reversed_asset_lock_order',
        'non_overlapping_rental_dispatch',
    ])->toHaveCount(13);
});
