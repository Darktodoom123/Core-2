<?php

namespace App\Services;

use App\Models\CommandLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class IdempotentCommandService
{
    /**
     * Process a command idempotently for a user.
     */
    public function process(
        User $user,
        string $commandId,
        string $actionName,
        ?int $expectedVersion,
        callable $execution
    ): Response {
        $existing = CommandLog::query()
            ->where('user_id', $user->id)
            ->where('command_id', $commandId)
            ->first();

        if ($existing) {
            $payload = $existing->response_payload ?? [];

            return new JsonResponse($payload, $existing->response_code);
        }

        $response = $execution();

        $responseCode = $response instanceof Response ? $response->getStatusCode() : 200;
        $responseContent = null;

        if ($response instanceof JsonResponse) {
            $responseContent = json_decode($response->getContent() ?: '{}', true);
        } elseif (method_exists($response, 'getSession')) {
            $responseContent = ['status' => 'success'];
        }

        CommandLog::query()->create([
            'user_id' => $user->id,
            'command_id' => $commandId,
            'action_name' => $actionName,
            'expected_version' => $expectedVersion,
            'status' => $responseCode >= 400 ? ($responseCode === 409 ? 'conflict' : 'failed') : 'completed',
            'response_code' => $responseCode,
            'response_payload' => $responseContent,
        ]);

        return $response;
    }
}
