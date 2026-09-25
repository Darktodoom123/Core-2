<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SiteHazardTicket;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LogSiteHazardTicket
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /**
     * @param array{
     *     project_site: string,
     *     category: string,
     *     severity: string,
     *     description: string,
     *     location_detail: string,
     *     photo_evidence_url?: string|null,
     *     corrective_action_required: string,
     *     location_latitude?: float|null,
     *     location_longitude?: float|null,
     *     location_accuracy_metres?: float|null,
     *     location_observed_at?: string|null,
     * } $data
     */
    public function handle(User $reporter, array $data): SiteHazardTicket
    {
        return DB::transaction(function () use ($reporter, $data): SiteHazardTicket {
            $code = sprintf('HAZ-%s-%s', date('Ymd'), strtoupper(Str::random(4)));

            $ticket = SiteHazardTicket::query()->create([
                'ticket_code' => $code,
                'project_site' => $data['project_site'],
                'reporter_id' => $reporter->id,
                'category' => $data['category'],
                'severity' => $data['severity'],
                'description' => $data['description'],
                'location_detail' => $data['location_detail'],
                'photo_evidence_url' => $data['photo_evidence_url'] ?? null,
                'corrective_action_required' => $data['corrective_action_required'],
                'location_latitude' => $data['location_latitude'] ?? null,
                'location_longitude' => $data['location_longitude'] ?? null,
                'location_accuracy_metres' => $data['location_accuracy_metres'] ?? null,
                'location_observed_at' => $data['location_observed_at'] ?? null,
                'status' => 'open',
                'work_stoppage_issued' => false,
            ]);

            $this->audit->handle($reporter, $ticket, 'safety.hazard_reported', null, [
                'ticket_code' => $ticket->ticket_code,
                'project_site' => $ticket->project_site,
                'severity' => $ticket->severity,
                'status' => $ticket->status,
                'location_latitude' => $ticket->location_latitude,
                'location_longitude' => $ticket->location_longitude,
            ]);

            return $ticket;
        });
    }

    public function rectify(User $user, SiteHazardTicket $ticket, string $rectificationNotes): SiteHazardTicket
    {
        return DB::transaction(function () use ($user, $ticket, $rectificationNotes): SiteHazardTicket {
            /** @var SiteHazardTicket $lockedTicket */
            $lockedTicket = SiteHazardTicket::query()->whereKey($ticket->id)->lockForUpdate()->firstOrFail();

            if ($lockedTicket->status === 'rectified') {
                return $lockedTicket;
            }

            $before = $lockedTicket->only(['status', 'rectified_by', 'rectified_at', 'rectification_notes']);
            $lockedTicket->update([
                'status' => 'rectified',
                'rectified_by' => $user->id,
                'rectified_at' => Carbon::now(),
                'rectification_notes' => trim($rectificationNotes),
            ]);

            $refreshed = $lockedTicket->fresh();
            $this->audit->handle($user, $refreshed, 'safety.hazard_rectified', $before, $refreshed->only(['status', 'rectified_by', 'rectified_at', 'rectification_notes']), $rectificationNotes);

            return $refreshed;
        });
    }
}
