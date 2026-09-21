<?php

namespace App\Modules\Fleet\Models;

use App\Modules\Fleet\Enums\AssetDocumentCategory;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $operational_asset_id
 * @property string $category
 * @property string $document_type
 * @property string $title
 * @property string $document_number
 * @property string $issuing_authority
 * @property Carbon|null $issued_at
 * @property Carbon|null $expires_at
 * @property string $status
 * @property string|null $notes
 * @property int|null $created_by
 * @property int|null $updated_by
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read OperationalAsset $operationalAsset
 * @property-read Attachment|null $latestAttachment
 * @property-read User|null $creator
 * @property-read User|null $updater
 */
class AssetDocument extends Model
{
    protected $fillable = [
        'operational_asset_id',
        'category',
        'document_type',
        'title',
        'document_number',
        'issuing_authority',
        'issued_at',
        'expires_at',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'date',
            'expires_at' => 'date',
        ];
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function operationalAsset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @return MorphMany<Attachment, $this> */
    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'owner');
    }

    /** @return MorphOne<Attachment, $this> */
    public function latestAttachment(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'owner')->latestOfMany();
    }

    public function isExpired(?CarbonInterface $now = null): bool
    {
        if ($this->expires_at === null) {
            return false;
        }

        $at = $now ? Carbon::instance($now)->timezone('Asia/Manila')->startOfDay() : Carbon::now('Asia/Manila')->startOfDay();
        $expiry = Carbon::parse($this->expires_at, 'Asia/Manila')->startOfDay();

        return $expiry->lessThan($at);
    }

    public function expiresSoon(?CarbonInterface $now = null, int $days = 30): bool
    {
        if ($this->expires_at === null || $this->isExpired($now)) {
            return false;
        }

        $at = $now ? Carbon::instance($now)->timezone('Asia/Manila')->startOfDay() : Carbon::now('Asia/Manila')->startOfDay();
        $expiry = Carbon::parse($this->expires_at, 'Asia/Manila')->startOfDay();

        $diff = $at->diffInDays($expiry, false);

        return $diff >= 0 && $diff <= $days;
    }

    public function validityStatus(?CarbonInterface $now = null): string
    {
        if ($this->status === 'revoked') {
            return 'revoked';
        }

        if ($this->status === 'superseded') {
            return 'superseded';
        }

        if ($this->isExpired($now)) {
            return 'expired';
        }

        if ($this->expiresSoon($now)) {
            return 'expiring_soon';
        }

        if ($this->expires_at === null) {
            return 'no_expiration';
        }

        return 'valid';
    }

    public function categoryLabel(): string
    {
        return AssetDocumentCategory::tryFrom($this->category)?->label()
            ?? ucwords(str_replace('_', ' ', $this->category));
    }

    /**
     * Scope documents visible to a user based on asset authorization
     *
     * @param  Builder<AssetDocument>  $query
     * @return Builder<AssetDocument>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can(PermissionName::FleetViewAll->value) || $user->can(PermissionName::EquipmentViewAll->value)) {
            return $query;
        }

        return $query->whereHas('operationalAsset', function (Builder $assetQuery) use ($user) {
            /** @var Builder<OperationalAsset> $assetQuery */
            $assetQuery->visibleTo($user);
        });
    }
}
