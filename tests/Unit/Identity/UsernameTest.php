<?php

use App\Platform\Identity\Support\Username;
use App\Platform\Identity\Support\UsernameBackfill;

it('normalizes usernames and accepts only the documented safe format', function (): void {
    expect(Username::normalize('  Jane.Doe_2  '))->toBe('jane.doe_2')
        ->and(Username::isValid('jane-doe'))->toBeTrue()
        ->and(Username::isValid('no spaces'))->toBeFalse()
        ->and(Username::isValid('-leading'))->toBeFalse()
        ->and(Username::isValid('trailing-'))->toBeFalse()
        ->and(Username::isValid('a'))->toBeFalse()
        ->and(Username::isValid('ab'))->toBeFalse();
});

it('backfills existing users deterministically from email local parts', function (): void {
    $assignments = UsernameBackfill::assignments([
        ['id' => 10, 'email' => 'Alex@example.test'],
        ['id' => 20, 'email' => 'alex@example.org'],
        ['id' => 30, 'email' => 'Alex+field@example.net'],
        ['id' => 40, 'email' => '!!!@example.net'],
    ]);

    expect($assignments)->toBe([
        10 => 'alex',
        20 => 'alex-2',
        30 => 'alex-field',
        40 => 'user-40',
    ]);
});

it('falls back when an email local part is too short for the username contract', function (): void {
    expect(Username::fromEmail('a@example.test', 7))->toBe('user-7');
});

it('transliterates unicode email local parts during backfill', function (): void {
    expect(Username::fromEmail('José@example.test', 8))->toBe('jose');
});
