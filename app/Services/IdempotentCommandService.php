<?php

namespace App\Services;

use App\Models\CommandLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

class IdempotentCommandService
{
    public function resolveCommandId(Request $request, bool $required = false): ?string
    {
        $headerId = $request->header('Idempotency-Key');
        $bodyId = $request->input('command_id');

        if ($bodyId !== null && ! is_string($bodyId)) {
            throw ValidationException::withMessages([
                'command_id' => ['The command id must be a valid UUID.'],
            ]);
        }

        if ($headerId !== null && $bodyId !== null && ! hash_equals($headerId, $bodyId)) {
            throw ValidationException::withMessages([
                'command_id' => ['The Idempotency-Key header and command_id body field must match.'],
            ]);
        }

        $commandId = $headerId ?: $bodyId;

        if ($required && ($commandId === null || $commandId === '')) {
            throw ValidationException::withMessages([
                'command_id' => ['An idempotency key is required for this command.'],
            ]);
        }

        if ($commandId !== null && ! Str::isUuid($commandId)) {
            throw ValidationException::withMessages([
                'command_id' => ['The idempotency key must be a valid UUID.'],
            ]);
        }

        return $commandId;
    }

    /**
     * Process a command idempotently for a user.
     *
     * @param  array<string|int, mixed>  $requestPayload
     */
    public function process(
        User $user,
        string $commandId,
        string $actionName,
        ?int $expectedVersion,
        callable $execution,
        array $requestPayload = []
    ): Response {
        if (! Str::isUuid($commandId)) {
            throw ValidationException::withMessages([
                'command_id' => ['The idempotency key must be a valid UUID.'],
            ]);
        }

        return Cache::lock("idempotent_command:{$user->id}:{$commandId}", 10)->block(5, function () use ($user, $commandId, $actionName, $expectedVersion, $execution, $requestPayload): Response {
            return $this->processLocked($user, $commandId, $actionName, $expectedVersion, $execution, $requestPayload);
        });
    }

    /** @param array<string|int, mixed> $requestPayload */
    private function processLocked(User $user, string $commandId, string $actionName, ?int $expectedVersion, callable $execution, array $requestPayload): Response
    {
        $payloadHash = hash('sha256', json_encode($this->sortKeys($requestPayload), JSON_THROW_ON_ERROR));
        $existing = CommandLog::query()->where('user_id', $user->id)->where('command_id', $commandId)->first();

        if ($existing) {
            if ($existing->payload_hash === null) {
                throw ValidationException::withMessages([
                    'command_id' => ['This idempotency key cannot be safely replayed. Submit a new UUID.'],
                ]);
            }

            if (
                $existing->action_name !== $actionName
                || $existing->expected_version !== $expectedVersion
                || ! hash_equals($existing->payload_hash, $payloadHash)
            ) {
                throw ValidationException::withMessages(['command_id' => 'This idempotency key was already used for a different command payload.']);
            }

            $decodedPayload = $existing->response_payload;
            if ($decodedPayload === null && is_string($rawPayload = $existing->getRawOriginal('response_payload'))) {
                $decodedPayload = json_decode($rawPayload, true);
            }
            /** @var array<string, mixed> $payload */
            $payload = is_array($decodedPayload) ? $decodedPayload : [];

            if (($payload['type'] ?? null) === 'redirect') {
                if (array_key_exists('flash', $payload) && request()->hasSession()) {
                    request()->session()->flash('flash', $payload['flash']);
                }

                return new RedirectResponse((string) $payload['url'], $existing->response_code);
            }

            return new JsonResponse($payload, $existing->response_code);
        }

        $response = DB::transaction(function () use ($user, $commandId, $actionName, $expectedVersion, $execution, $payloadHash): Response {
            $response = $execution();

            $responseCode = $response instanceof Response ? $response->getStatusCode() : 200;
            $responseContent = null;

            if ($response instanceof JsonResponse) {
                $responseContent = json_decode($response->getContent() ?: '{}', true);
            } elseif ($response instanceof RedirectResponse) {
                $responseContent = ['type' => 'redirect', 'url' => $response->getTargetUrl()];

                if (request()->hasSession() && request()->session()->has('flash')) {
                    $responseContent['flash'] = request()->session()->get('flash');
                }
            }

            CommandLog::query()->create([
                'user_id' => $user->id,
                'command_id' => $commandId,
                'action_name' => $actionName,
                'payload_hash' => $payloadHash,
                'expected_version' => $expectedVersion,
                'status' => $responseCode >= 400 ? ($responseCode === 409 ? 'conflict' : 'failed') : 'completed',
                'response_code' => $responseCode,
                'response_payload' => $responseContent,
            ]);

            return $response;
        });

        return $response;
    }

    /**
     * @param  array<string|int, mixed>  $payload
     * @return array<string|int, mixed>
     */
    private function sortKeys(array $payload): array
    {
        foreach ($payload as $key => $value) {
            if (is_array($value)) {
                $payload[$key] = $this->sortKeys($value);
            }
        }

        if (array_keys($payload) !== range(0, count($payload) - 1)) {
            ksort($payload);
        }

        return $payload;
    }
}
