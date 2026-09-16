<?php

namespace Tracking\Http\Requests;

use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

final class IngestLocationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, string>> */
    public function rules(): array
    {
        $sharing = $this->has('sharing_enabled') ? $this->boolean('sharing_enabled') : true;

        return [
            'command_id' => ['nullable', 'string', 'max:64'],
            'user_id' => ['required', 'integer', 'min:1'],
            'operational_asset_id' => ['nullable', 'integer', 'min:1'],
            'dispatch_job_id' => ['nullable', 'integer', 'min:1'],
            'latitude' => $sharing
                ? ['required', 'numeric', 'between:-90,90']
                : ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => $sharing
                ? ['required', 'numeric', 'between:-180,180']
                : ['nullable', 'numeric', 'between:-180,180'],
            'accuracy_metres' => ['nullable', 'numeric', 'min:0'],
            'speed' => ['nullable', 'numeric', 'min:0'],
            'remarks' => ['nullable', 'string', 'max:500'],
            'source' => ['nullable', 'string', 'max:50'],
            'sharing_enabled' => ['nullable', 'boolean'],
            'captured_at' => ['nullable', 'date'],
            'received_at' => ['nullable', 'date'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $idempotencyKey = $this->header('Idempotency-Key');
            $xCommandId = $this->header('X-Command-Id');
            $bodyId = $this->input('command_id');

            if ($idempotencyKey !== null && $xCommandId !== null && ! hash_equals($idempotencyKey, $xCommandId)) {
                $validator->errors()->add('command_id', 'The Idempotency-Key and X-Command-Id headers must match.');
            }

            $headerId = $xCommandId ?? $idempotencyKey;
            if ($headerId !== null && $bodyId !== null && ! hash_equals((string) $headerId, (string) $bodyId)) {
                $headerName = $xCommandId !== null ? 'X-Command-Id' : 'Idempotency-Key';
                $validator->errors()->add('command_id', "The {$headerName} header and command_id body field must match.");
            }

            $capturedAtRaw = $this->input('captured_at');
            if (is_string($capturedAtRaw) && $capturedAtRaw !== '') {
                try {
                    $parsed = CarbonImmutable::parse($capturedAtRaw);
                    if ($parsed->greaterThan(now()->addSeconds(300))) {
                        $validator->errors()->add('captured_at', 'The captured_at timestamp cannot be in the future beyond clock drift tolerance.');
                    }
                } catch (\Throwable) {
                    $validator->errors()->add('captured_at', 'The captured_at timestamp is invalid.');
                }
            }
        });
    }
}
