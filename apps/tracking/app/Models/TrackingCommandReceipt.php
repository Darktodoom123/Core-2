<?php

namespace Tracking\Models;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $command_id
 * @property string $action
 * @property string|null $payload_hash
 * @property int|null $user_id
 * @property int|null $location_sample_id
 * @property int $status_code
 * @property array<string, mixed>|null $response_payload
 * @property CarbonImmutable|null $received_at
 * @property CarbonImmutable|null $created_at
 * @property CarbonImmutable|null $updated_at
 */
final class TrackingCommandReceipt extends Model
{
    protected $table = 'tracking_command_receipts';

    protected $guarded = [];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'user_id' => 'integer',
            'location_sample_id' => 'integer',
            'status_code' => 'integer',
            'response_payload' => 'array',
            'received_at' => 'immutable_datetime',
        ];
    }
}
