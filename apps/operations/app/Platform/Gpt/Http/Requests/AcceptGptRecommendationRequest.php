<?php

namespace App\Platform\Gpt\Http\Requests;

use App\Platform\Gpt\Models\GptRecommendation;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Validator;

final class AcceptGptRecommendationRequest extends FormRequest
{
    public function authorize(): bool
    {
        $recommendation = $this->route('recommendation');

        return $recommendation instanceof GptRecommendation
            && Gate::forUser($this->user())->allows('decide', $recommendation);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'selected_personnel_ids' => ['sometimes', 'array'],
            'selected_personnel_ids.*' => ['integer', 'min:1'],
            'personnel' => ['sometimes', 'array'],
            'selected_asset_ids' => ['sometimes', 'array'],
            'selected_asset_ids.*' => ['integer', 'min:1'],
            'assets' => ['sometimes', 'array'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $recommendation = $this->route('recommendation');
            if (! $recommendation instanceof GptRecommendation) {
                return;
            }

            $hasPersonnelSelection = $this->has('selected_personnel_ids') || $this->has('personnel');
            $hasAssetSelection = $this->has('selected_asset_ids') || $this->has('assets');

            if (! $hasPersonnelSelection && ! $hasAssetSelection) {
                return;
            }

            $rawPayload = $recommendation->recommendation;
            $rawPersonnel = is_array($rawPayload) && is_array($rawPayload['proposed_personnel'] ?? null)
                ? $rawPayload['proposed_personnel']
                : [];
            $proposedPersonnelIds = array_values(array_filter(array_map(static function (mixed $p): ?int {
                $id = is_array($p) ? (int) ($p['user_id'] ?? 0) : (is_numeric($p) ? (int) $p : 0);

                return $id > 0 ? $id : null;
            }, $rawPersonnel)));

            $rawAssets = is_array($rawPayload) && is_array($rawPayload['proposed_assets'] ?? null)
                ? $rawPayload['proposed_assets']
                : [];
            $proposedAssetIds = array_values(array_filter(array_map(static function (mixed $a): ?int {
                $id = is_array($a) ? (int) ($a['operational_asset_id'] ?? $a['asset_id'] ?? 0) : (is_numeric($a) ? (int) $a : 0);

                return $id > 0 ? $id : null;
            }, $rawAssets)));

            $selectedPersonnel = $this->selectedPersonnel();
            if ($selectedPersonnel !== null) {
                $personnelErrorKey = $this->has('personnel') ? 'personnel' : 'selected_personnel_ids';
                foreach ($selectedPersonnel as $id) {
                    if (! in_array($id, $proposedPersonnelIds, true)) {
                        $validator->errors()->add($personnelErrorKey, "Personnel ID {$id} was not proposed in this recommendation.");
                    }
                }
            }

            $selectedAssets = $this->selectedAssets();
            if ($selectedAssets !== null) {
                $assetErrorKey = $this->has('assets') ? 'assets' : 'selected_asset_ids';
                foreach ($selectedAssets as $id) {
                    if (! in_array($id, $proposedAssetIds, true)) {
                        $validator->errors()->add($assetErrorKey, "Asset ID {$id} was not proposed in this recommendation.");
                    }
                }
            }

            $hasProposedResources = $proposedPersonnelIds !== [] || $proposedAssetIds !== [];
            $effectivePersonnel = $hasPersonnelSelection ? ($selectedPersonnel ?? []) : $proposedPersonnelIds;
            $effectiveAssets = $hasAssetSelection ? ($selectedAssets ?? []) : $proposedAssetIds;
            $totalEffectiveSelected = count($effectivePersonnel) + count($effectiveAssets);

            if ($hasProposedResources && $totalEffectiveSelected === 0) {
                $validator->errors()->add('resources', 'At least one proposed resource must be selected.');
            }
        });
    }

    /**
     * @return list<int>|null
     */
    public function selectedPersonnel(): ?array
    {
        if ($this->has('selected_personnel_ids')) {
            $raw = (array) $this->input('selected_personnel_ids', []);

            return array_values(array_map(static function (mixed $p): int {
                return is_numeric($p) ? (int) $p : 0;
            }, $raw));
        }

        if ($this->has('personnel')) {
            $raw = (array) $this->input('personnel', []);

            return array_values(array_map(static function (mixed $p): int {
                if (is_array($p)) {
                    return isset($p['user_id']) && is_numeric($p['user_id']) ? (int) $p['user_id'] : 0;
                }

                return is_numeric($p) ? (int) $p : 0;
            }, $raw));
        }

        return null;
    }

    /**
     * @return list<int>|null
     */
    public function selectedAssets(): ?array
    {
        if ($this->has('selected_asset_ids')) {
            $raw = (array) $this->input('selected_asset_ids', []);

            return array_values(array_map(static function (mixed $a): int {
                return is_numeric($a) ? (int) $a : 0;
            }, $raw));
        }

        if ($this->has('assets')) {
            $raw = (array) $this->input('assets', []);

            return array_values(array_map(static function (mixed $a): int {
                if (is_array($a)) {
                    $id = $a['operational_asset_id'] ?? $a['asset_id'] ?? null;

                    return isset($id) && is_numeric($id) ? (int) $id : 0;
                }

                return is_numeric($a) ? (int) $a : 0;
            }, $raw));
        }

        return null;
    }
}
