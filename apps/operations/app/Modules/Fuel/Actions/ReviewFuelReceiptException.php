<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Models\FuelLog;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** A verifier accepts the stated reason for a refuel logged without a receipt. */
final class ReviewFuelReceiptException
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, FuelLog $log, ?string $note = null): FuelLog
    {
        if (! $actor->can(PermissionName::FuelVerify->value)) {
            throw new AuthorizationException;
        }

        return DB::transaction(function () use ($actor, $log, $note): FuelLog {
            /** @var FuelLog $locked */
            $locked = FuelLog::query()->lockForUpdate()->findOrFail($log->id);

            if (! $locked->requiresReceiptReview()) {
                throw ValidationException::withMessages(['receipt' => 'This fuel log has no receipt exception waiting for review.']);
            }

            $locked->update([
                'receipt_reviewed_by' => $actor->id,
                'receipt_reviewed_at' => now(),
                'receipt_review_note' => $note !== null && trim($note) !== '' ? trim($note) : null,
            ]);
            $this->audit->handle($actor, $locked, 'fuel.receipt_exception_reviewed', null, ['no_receipt_reason' => $locked->no_receipt_reason], $locked->receipt_review_note);

            return $locked->refresh();
        });
    }
}
