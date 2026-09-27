<?php

namespace App\Modules\Assignment\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\UnitLinkReleaseReason;
use App\Shared\Assets\Models\UnitLink;
use App\Shared\Assets\Services\UnitLinkReleaser;
use Illuminate\Support\Facades\DB;

/** The operator releases the unit they hold. Releasing nothing is not an error. */
final class ReleaseUnit
{
    public function __construct(
        private readonly UnitLinkReleaser $releaser,
        private readonly RecordAuditEvent $audit,
    ) {}

    public function handle(User $actor): ?UnitLink
    {
        return DB::transaction(function () use ($actor): ?UnitLink {
            User::query()->whereKey($actor->id)->lockForUpdate()->first();

            $link = $this->releaser->forUser($actor->id, UnitLinkReleaseReason::Released)->first();

            if ($link !== null) {
                $this->audit->handle(
                    $actor,
                    $link->asset,
                    'fleet.unit_released',
                    ['operator_id' => $actor->id],
                    null,
                    'Operator released the unit.',
                );
            }

            return $link;
        });
    }
}
