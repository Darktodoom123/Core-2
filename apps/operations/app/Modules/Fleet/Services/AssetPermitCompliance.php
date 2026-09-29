<?php

namespace App\Modules\Fleet\Services;

use App\Modules\Fleet\Enums\AssetDocumentCategory;
use App\Modules\Fleet\Models\AssetDocument;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Checks an asset's required permits against the last day it will be used.
 * Permits are dated in Manila and stay valid through their expiry date.
 *
 * @phpstan-type PermitItem array{category: string, label: string, state: 'valid'|'expired'|'revoked'|'missing', document_id: int|null, expires_at: string|null, days_left: int|null}
 */
final class AssetPermitCompliance
{
    private const TIMEZONE = 'Asia/Manila';

    /** @return list<string> */
    public function requiredCategories(OperationalAsset $asset): array
    {
        $required = config('fleet.required_permits.'.strtolower((string) $asset->kind), []);

        return is_array($required) ? array_values(array_filter($required, 'is_string')) : [];
    }

    /** @return list<PermitItem> */
    public function assess(OperationalAsset $asset, ?CarbonInterface $validThrough = null): array
    {
        return $this->assessMany([$asset], $validThrough)[(int) $asset->id] ?? [];
    }

    /**
     * @param  iterable<OperationalAsset>  $assets
     * @return array<int, list<PermitItem>>
     */
    public function assessMany(iterable $assets, ?CarbonInterface $validThrough = null): array
    {
        $required = [];
        foreach ($assets as $asset) {
            $required[(int) $asset->id] = $this->requiredCategories($asset);
        }
        $required = array_filter($required);
        if ($required === []) {
            return [];
        }

        $today = CarbonImmutable::now(self::TIMEZONE)->startOfDay();
        $through = CarbonImmutable::instance($validThrough ?? $today)->timezone(self::TIMEZONE)->toDateString();
        $documents = AssetDocument::query()
            ->whereIn('operational_asset_id', array_keys($required))
            ->whereIn('category', array_values(array_unique(array_merge(...array_values($required)))))
            ->where('status', '!=', 'superseded')
            ->get(['id', 'operational_asset_id', 'category', 'expires_at', 'status'])
            ->groupBy(fn (AssetDocument $doc): string => $doc->operational_asset_id.':'.$doc->category);

        $result = [];
        foreach ($required as $assetId => $categories) {
            $result[$assetId] = array_map(
                fn (string $category): array => $this->item($category, $documents->get($assetId.':'.$category, collect()), $through, $today),
                $categories,
            );
        }

        return $result;
    }

    /**
     * Summarise permits for the Fleet screen from documents that are already loaded.
     *
     * @param  iterable<AssetDocument>  $documents
     * @return array{state: 'not_required'|'valid'|'expiring'|'missing'|'expired', blocks_dispatch: bool, items: list<array{category: string, label: string, state: 'valid'|'expired'|'revoked'|'missing', document_id: int|null, expires_at: string|null, days_left: int|null, blocks_dispatch: bool}>}
     */
    public function summary(OperationalAsset $asset, iterable $documents): array
    {
        $today = CarbonImmutable::now(self::TIMEZONE)->startOfDay();
        $grouped = collect($documents)
            ->filter(fn (AssetDocument $doc): bool => $doc->status !== 'superseded')
            ->groupBy('category');
        $items = array_map(
            fn (string $category): array => $this->item($category, $grouped->get($category, collect()), $today->toDateString(), $today),
            $this->requiredCategories($asset),
        );
        $warningDays = (int) config('fleet.permit_warning_days', 30);
        $states = array_column($items, 'state');
        $blockingCategories = array_column($this->blocking($items), 'category');

        return [
            'state' => match (true) {
                $items === [] => 'not_required',
                in_array('expired', $states, true) || in_array('revoked', $states, true) => 'expired',
                in_array('missing', $states, true) => 'missing',
                collect($items)->contains(fn (array $item): bool => $item['days_left'] !== null && $item['days_left'] <= $warningDays) => 'expiring',
                default => 'valid',
            },
            'blocks_dispatch' => $blockingCategories !== [],
            'items' => array_map(
                static fn (array $item): array => [...$item, 'blocks_dispatch' => in_array($item['category'], $blockingCategories, true)],
                $items,
            ),
        ];
    }

    /** @return list<PermitItem> */
    public function blockingIssues(OperationalAsset $asset, ?CarbonInterface $validThrough = null): array
    {
        return $this->blocking($this->assess($asset, $validThrough));
    }

    /**
     * @param  iterable<OperationalAsset>  $assets
     * @return array<int, list<PermitItem>>
     */
    public function blockingIssuesForAssets(iterable $assets, ?CarbonInterface $validThrough = null): array
    {
        return array_map(fn (array $items): array => $this->blocking($items), $this->assessMany($assets, $validThrough));
    }

    /** @param list<PermitItem> $items
     * @return list<PermitItem>
     */
    private function blocking(array $items): array
    {
        $blockMissing = (bool) config('fleet.block_missing_permits', false);

        return array_values(array_filter(
            $items,
            static fn (array $item): bool => in_array($item['state'], ['expired', 'revoked'], true)
                || ($blockMissing && $item['state'] === 'missing'),
        ));
    }

    /**
     * @param  Collection<int, AssetDocument>  $candidates
     * @return PermitItem
     */
    private function item(string $category, Collection $candidates, string $through, CarbonImmutable $today): array
    {
        $active = $candidates->where('status', 'active');
        $valid = $active
            ->filter(fn (AssetDocument $doc): bool => $doc->expires_at === null || $doc->expires_at->toDateString() >= $through)
            ->sortByDesc(fn (AssetDocument $doc): string => $doc->expires_at?->toDateString() ?? '9999-12-31')
            ->first();
        $latest = $valid ?? $active->sortByDesc(fn (AssetDocument $doc): string => $doc->expires_at?->toDateString() ?? '')->first();
        $expiresAt = $latest?->expires_at?->toDateString();

        return [
            'category' => $category,
            'label' => AssetDocumentCategory::tryFrom($category)?->label() ?? ucwords(str_replace('_', ' ', $category)),
            'state' => match (true) {
                $valid !== null => 'valid',
                $latest !== null => 'expired',
                $candidates->isNotEmpty() => 'revoked',
                default => 'missing',
            },
            'document_id' => $latest?->id,
            'expires_at' => $expiresAt,
            'days_left' => $expiresAt === null ? null : (int) $today->diffInDays(CarbonImmutable::parse($expiresAt, self::TIMEZONE), false),
        ];
    }
}
