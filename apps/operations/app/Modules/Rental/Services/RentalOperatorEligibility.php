<?php

namespace App\Modules\Rental\Services;

use App\Modules\Rental\Enums\RentalOperatorType;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

final class RentalOperatorEligibility
{
    /**
     * @return array{eligible: bool, reasons: list<string>, credential_status: string}
     */
    public function assess(User $operator, RentalOperatorType $type, CarbonInterface $at): array
    {
        $reasons = [];

        if (! $operator->hasRole($type->role()->value)) {
            $reasons[] = 'Personnel role does not qualify for this rental operator type.';
        }

        if (! $operator->is_active) {
            $reasons[] = 'Personnel account is inactive.';
        } elseif ($operator->suspended_at !== null) {
            $reasons[] = 'Personnel account is suspended.';
        }

        $profile = $operator->getRelationValue('personnelProfile');
        $availability = $profile instanceof PersonnelProfile
            ? $profile->availability_status
            : 'not_recorded';
        if (in_array($availability, ['unavailable', 'on_leave'], true)) {
            $reasons[] = "Personnel availability is {$availability}.";
        }

        $credentialStatus = $this->credentialStatus($operator, $type, $at);
        if ($credentialStatus !== 'valid') {
            $reasons[] = match ($credentialStatus) {
                'missing' => 'Required operating credential is missing.',
                'expired' => 'Required operating credential is expired.',
                'inactive' => 'Required operating credential is inactive.',
                'not_yet_valid' => 'Required operating credential is not yet valid.',
                default => 'Required operating credential is invalid.',
            };
        }

        return [
            'eligible' => $reasons === [],
            'reasons' => $reasons,
            'credential_status' => $credentialStatus,
        ];
    }

    private function credentialStatus(User $operator, RentalOperatorType $type, CarbonInterface $at): string
    {
        $credentials = $operator->relationLoaded('personnelCredentials')
            ? $operator->getRelation('personnelCredentials')
            : $operator->personnelCredentials()->where('kind', $type->credentialKind())->get();

        /** @var Collection<int, PersonnelCredential> $credentials */
        $credentials = $credentials
            ->filter(static fn (PersonnelCredential $credential): bool => $credential->kind === $type->credentialKind())
            ->sortByDesc(static fn (PersonnelCredential $credential): string => $credential->expires_at?->toDateString() ?? '9999-12-31')
            ->values();
        $valid = $credentials->first(static fn (PersonnelCredential $credential): bool => $credential->status === 'active'
            && ($credential->issued_at === null || $credential->issued_at->toDateString() <= $at->toDateString())
            && ($credential->expires_at === null || $credential->expires_at->toDateString() >= $at->toDateString()));

        if ($valid instanceof PersonnelCredential) {
            return 'valid';
        }

        $latest = $credentials->first();
        if (! $latest instanceof PersonnelCredential) {
            return 'missing';
        }

        return match (true) {
            $latest->status !== 'active' => 'inactive',
            $latest->issued_at !== null && $latest->issued_at->toDateString() > $at->toDateString() => 'not_yet_valid',
            default => 'expired',
        };
    }
}
