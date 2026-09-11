<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Models\DispatchPlanVersion;

final class DispatchPlanMateriality
{
    /** @param array<string, mixed> $snapshot */
    public function hash(array $snapshot, mixed $scheduledStart = null, mixed $scheduledEnd = null): string
    {
        $material = [
            'scheduled_start' => is_object($scheduledStart) && method_exists($scheduledStart, 'toIso8601String') ? $scheduledStart->toIso8601String() : $scheduledStart,
            'scheduled_end' => is_object($scheduledEnd) && method_exists($scheduledEnd, 'toIso8601String') ? $scheduledEnd->toIso8601String() : $scheduledEnd,
        ];
        foreach (['mandatory_assignments', 'requirements', 'offers', 'assignments', 'lead', 'lead_user_id', 'designated_lead_offer_id', 'assets', 'asset_assignments', 'source', 'source_type', 'source_id', 'safety', 'eligibility'] as $key) {
            if (array_key_exists($key, $snapshot)) {
                $material[$key] = $this->canonical($snapshot[$key]);
            }
        }

        return hash('sha256', (string) json_encode($this->canonical($material), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    /** @param array<string, mixed> $snapshot */
    public function changed(DispatchPlanVersion $current, array $snapshot, mixed $scheduledStart = null, mixed $scheduledEnd = null): bool
    {
        return $this->hash($current->snapshot, $current->scheduled_start, $current->scheduled_end)
            !== $this->hash($snapshot, $scheduledStart, $scheduledEnd);
    }

    private function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return is_object($value) && method_exists($value, 'toIso8601String') ? $value->toIso8601String() : $value;
        }
        if (array_is_list($value)) {
            return array_map(fn (mixed $item): mixed => $this->canonical($item), $value);
        }
        ksort($value);

        return array_map(fn (mixed $item): mixed => $this->canonical($item), $value);
    }
}
