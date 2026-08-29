<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\ToolboxMeetingChanged;
use App\Platform\Safety\Models\ToolboxMeeting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SubmitToolboxMeeting
{
    /**
     * @param array{
     *     project_site: string,
     *     topic_id: string,
     *     topic_title: string,
     *     topic_category: string,
     *     attendee_ids: array<string>,
     *     photo_evidence_url?: string|null,
     *     notes?: string|null,
     * } $data
     */
    public function handle(User $conductor, array $data): ToolboxMeeting
    {
        if (empty($data['attendee_ids'])) {
            throw ValidationException::withMessages([
                'attendee_ids' => 'At least one attendee must be checked in for the Toolbox Meeting.',
            ]);
        }

        return DB::transaction(function () use ($conductor, $data): ToolboxMeeting {
            $now = Carbon::now();
            $hash = hash('sha256', sprintf(
                'PH-DOLE-TBM-%s-%s-%s-%d',
                $data['project_site'],
                $data['topic_id'],
                $now->toDateString(),
                count($data['attendee_ids'])
            ));

            $meeting = ToolboxMeeting::query()->create([
                'project_site' => $data['project_site'],
                'topic_id' => $data['topic_id'],
                'topic_title' => $data['topic_title'],
                'topic_category' => $data['topic_category'],
                'conductor_id' => $conductor->id,
                'conductor_role' => $conductor->operationalRole()?->label() ?? 'Field Supervisor',
                'attendee_ids' => $data['attendee_ids'],
                'attendee_count' => count($data['attendee_ids']),
                'photo_evidence_url' => $data['photo_evidence_url'] ?? null,
                'photo_timestamp' => isset($data['photo_evidence_url']) ? $now : null,
                'notes' => $data['notes'] ?? null,
                'audit_hash' => $hash,
            ]);

            event(new ToolboxMeetingChanged($meeting, 'submitted'));

            return $meeting;
        });
    }
}
