<?php

namespace App\Platform\Gpt\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class RejectGptRecommendation
{
    public function __construct(
        private RecordAuditEvent $audit
    ) {}

    public function handle(User $actor, GptRecommendation $recommendation, ?string $reason = null): GptRecommendation
    {
        Gate::forUser($actor)->authorize('decide', $recommendation);

        return DB::transaction(function () use ($actor, $recommendation, $reason): GptRecommendation {
            /** @var GptRecommendation $recommendation */
            $recommendation = GptRecommendation::query()->lockForUpdate()->findOrFail($recommendation->id);

            if (! in_array($recommendation->status, ['pending_review', 'draft', 'processing'], true)) {
                throw ValidationException::withMessages([
                    'gpt' => "Recommendation cannot be rejected in status '{$recommendation->status}'.",
                ]);
            }

            $recommendation->update([
                'status' => 'rejected',
                'decided_by' => $actor->id,
                'decided_at' => now(),
                'response_summary' => $reason,
            ]);

            $subject = $recommendation->subject;
            if ($subject !== null) {
                $this->audit->handle(
                    $actor,
                    $subject,
                    'gpt.recommendation_rejected',
                    null,
                    [
                        'recommendation_id' => $recommendation->id,
                        'purpose' => $recommendation->purpose,
                        'model' => $recommendation->model,
                    ],
                    $reason
                );
            }

            return $recommendation;
        });
    }
}
