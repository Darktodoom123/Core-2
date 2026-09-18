<?php

namespace App\Platform\Notifications\Services;

use App\Platform\Identity\Models\User;
use App\Platform\Identity\Models\UserDeviceToken;
use App\Platform\Notifications\Data\PushPayload;
use App\Platform\Notifications\Models\PushDelivery;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class PushNotificationService
{
    /**
     * Sends a push notification to all active devices of a given user.
     *
     * @return array{attempted: int, accepted: int, failed: int, deactivated: int, tickets: list<string>}
     */
    public function sendToUser(
        User $user,
        PushPayload $payload,
        ?string $deduplicationKey = null,
        ?string $relevanceType = null,
        string|int|null $relevanceId = null,
    ): array {
        if (! config('push.enabled', true)) {
            return [
                'attempted' => 0,
                'accepted' => 0,
                'failed' => 0,
                'deactivated' => 0,
                'tickets' => [],
            ];
        }

        // Fetch active device tokens for the user
        $deviceTokens = UserDeviceToken::query()
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->whereNull('revoked_at')
            ->get();

        if ($deviceTokens->isEmpty()) {
            return [
                'attempted' => 0,
                'accepted' => 0,
                'failed' => 0,
                'deactivated' => 0,
                'tickets' => [],
            ];
        }

        // Installation-scoped deduplication check:
        // Each distinct business event notifies every eligible active installation.
        // Retries of that same event skip already-accepted/delivered device tokens.
        $eligibleTokens = [];
        $existingTickets = [];

        foreach ($deviceTokens as $deviceToken) {
            if ($deduplicationKey !== null) {
                $alreadyDelivered = PushDelivery::query()
                    ->where('deduplication_key', $deduplicationKey)
                    ->where('user_device_token_id', $deviceToken->id)
                    ->whereIn('status', [
                        PushDelivery::STATUS_ACCEPTED,
                        PushDelivery::STATUS_DELIVERED,
                        PushDelivery::STATUS_OPENED,
                    ])
                    ->first();

                if ($alreadyDelivered !== null) {
                    if ($alreadyDelivered->ticket_id) {
                        $existingTickets[] = $alreadyDelivered->ticket_id;
                    }
                    Log::info('Push notification skipped for device token due to deduplication key match', [
                        'recipient_id' => $user->id,
                        'device_token_id' => $deviceToken->id,
                        'deduplication_key' => $deduplicationKey,
                        'existing_delivery_id' => $alreadyDelivered->id,
                    ]);

                    continue;
                }
            }

            $eligibleTokens[] = $deviceToken;
        }

        if (empty($eligibleTokens)) {
            return [
                'attempted' => 0,
                'accepted' => 0,
                'failed' => 0,
                'deactivated' => 0,
                'tickets' => $existingTickets,
            ];
        }

        $url = (string) config('push.expo_url', 'https://exp.host/--/api/v2/push/send');
        $timeout = (float) config('push.timeout_seconds', 5.0);
        $accessToken = config('push.expo_access_token');

        $messages = [];
        $tokenMap = [];
        $deliveryMap = [];

        $event = (string) ($payload->data['event'] ?? 'unknown');

        foreach ($eligibleTokens as $index => $deviceToken) {
            $delivery = PushDelivery::query()->create([
                'user_id' => $user->id,
                'user_device_token_id' => $deviceToken->id,
                'event' => $event,
                'relevance_type' => $relevanceType,
                'relevance_id' => $relevanceId !== null ? (string) $relevanceId : null,
                'deduplication_key' => $deduplicationKey,
                'status' => PushDelivery::STATUS_QUEUED,
                'queued_at' => now(),
                'provider' => 'expo',
            ]);

            $messages[] = $payload->toExpoMessage($deviceToken->token);
            $tokenMap[$index] = $deviceToken;
            $deliveryMap[$index] = $delivery;
        }

        try {
            $client = Http::timeout($timeout)
                ->acceptJson()
                ->asJson();

            if (! empty($accessToken)) {
                $client = $client->withToken($accessToken);
            }

            $response = $client->post($url, $messages);

            if ($response->status() === 429) {
                Log::warning('Push service provider rate limit encountered (429)', [
                    'recipient_id' => $user->id,
                    'retry_after' => $response->header('Retry-After'),
                ]);

                foreach ($deliveryMap as $del) {
                    $del->markFailed('RateLimitExceeded', 'Provider returned 429 rate limit');
                }

                throw new \RuntimeException('Push notification provider rate limit exceeded.');
            }

            if (! $response->successful()) {
                Log::warning('Push service provider error response', [
                    'recipient_id' => $user->id,
                    'status' => $response->status(),
                ]);

                foreach ($deliveryMap as $del) {
                    $del->markFailed('ProviderHttpError', 'Provider returned status '.$response->status());
                }

                return [
                    'attempted' => count($messages),
                    'accepted' => 0,
                    'failed' => count($messages),
                    'deactivated' => 0,
                    'tickets' => [],
                ];
            }

            return $this->processExpoSendResponse($response, $tokenMap, $deliveryMap, $user->id);
        } catch (ConnectionException $e) {
            Log::warning('Push notification provider network connection timeout', [
                'recipient_id' => $user->id,
                'error' => $e->getMessage(),
            ]);

            foreach ($deliveryMap as $del) {
                $del->markFailed('ConnectionTimeout', $e->getMessage());
            }

            throw $e;
        }
    }

    /**
     * @param  array<int, UserDeviceToken>  $tokenMap
     * @param  array<int, PushDelivery>  $deliveryMap
     * @return array{attempted: int, accepted: int, failed: int, deactivated: int, tickets: list<string>}
     */
    private function processExpoSendResponse(
        Response $response,
        array $tokenMap,
        array $deliveryMap,
        int $userId
    ): array {
        $json = $response->json();
        $tickets = [];
        $accepted = 0;
        $failed = 0;
        $deactivated = 0;

        $items = is_array($json) && isset($json['data']) && is_array($json['data']) ? $json['data'] : [];

        foreach ($items as $index => $item) {
            $deviceToken = $tokenMap[$index] ?? null;
            $delivery = $deliveryMap[$index] ?? null;
            $status = is_array($item) ? ($item['status'] ?? null) : null;

            if ($status === 'ok') {
                $accepted++;
                $ticketId = isset($item['id']) && is_string($item['id']) ? $item['id'] : null;
                if ($ticketId !== null) {
                    $tickets[] = $ticketId;
                    $delivery?->markAccepted($ticketId);
                } else {
                    $delivery?->update(['status' => PushDelivery::STATUS_ACCEPTED, 'sent_at' => now()]);
                }

                if ($deviceToken !== null) {
                    $deviceToken->update(['last_used_at' => now()]);
                }
            } else {
                $failed++;
                $errorType = is_array($item) && isset($item['details']['error'])
                    ? (string) $item['details']['error']
                    : (is_array($item) && isset($item['message']) ? (string) $item['message'] : 'SendFailed');
                $errorMessage = is_array($item) && isset($item['message']) ? (string) $item['message'] : null;

                $delivery?->markFailed($errorType, $errorMessage);

                // Handle permanent token rejection (e.g. DeviceNotRegistered)
                if ($errorType === 'DeviceNotRegistered' && $deviceToken !== null) {
                    $deviceToken->update([
                        'is_active' => false,
                        'revoked_at' => now(),
                    ]);
                    $deactivated++;

                    Log::info('Deactivated invalid/unregistered push device token', [
                        'recipient_id' => $userId,
                        'installation_id' => $deviceToken->installation_id,
                        'error' => $errorType,
                    ]);
                } else {
                    Log::warning('Push delivery ticket error from provider', [
                        'recipient_id' => $userId,
                        'error' => $errorType,
                    ]);
                }
            }
        }

        return [
            'attempted' => count($tokenMap),
            'accepted' => $accepted,
            'failed' => $failed,
            'deactivated' => $deactivated,
            'tickets' => $tickets,
        ];
    }

    /**
     * Checks delivery receipts for ticket IDs from provider.
     *
     * @param  list<string>  $ticketIds
     * @return array<string, array<string, mixed>>
     */
    public function checkReceipts(array $ticketIds): array
    {
        if (empty($ticketIds) || ! config('push.enabled', true)) {
            return [];
        }

        $url = (string) config('push.expo_receipts_url', 'https://exp.host/--/api/v2/push/getReceipts');
        $timeout = (float) config('push.timeout_seconds', 5.0);
        $accessToken = config('push.expo_access_token');

        try {
            $client = Http::timeout($timeout)->acceptJson()->asJson();
            if (! empty($accessToken)) {
                $client = $client->withToken($accessToken);
            }

            $response = $client->post($url, ['ids' => array_values(array_unique($ticketIds))]);
            if (! $response->successful()) {
                Log::warning('Expo receipts query returned non-200 status', [
                    'status' => $response->status(),
                ]);

                return [];
            }

            $json = $response->json();
            /** @var array<string, array<string, mixed>> $data */
            $data = is_array($json) && isset($json['data']) && is_array($json['data']) ? $json['data'] : [];

            return $data;
        } catch (\Throwable $e) {
            Log::warning('Failed to query push receipts', ['error' => $e->getMessage()]);

            return [];
        }
    }

    /**
     * Process pending receipts for accepted push deliveries and deactivate stale tokens.
     *
     * @return array{checked: int, delivered: int, failed: int, deactivated: int}
     */
    public function processPendingReceipts(int $batchSize = 100): array
    {
        /** @var Collection<int, PushDelivery> $deliveries */
        $deliveries = PushDelivery::query()
            ->pendingReceipt()
            ->with('deviceToken')
            ->limit($batchSize)
            ->get();

        if ($deliveries->isEmpty()) {
            return ['checked' => 0, 'delivered' => 0, 'failed' => 0, 'deactivated' => 0];
        }

        $ticketMap = [];
        foreach ($deliveries as $del) {
            if (! empty($del->ticket_id)) {
                $ticketMap[$del->ticket_id] = $del;
            }
        }

        $receipts = $this->checkReceipts(array_keys($ticketMap));

        $deliveredCount = 0;
        $failedCount = 0;
        $deactivatedCount = 0;

        foreach ($receipts as $ticketId => $receipt) {
            $delivery = $ticketMap[$ticketId] ?? null;
            if (! $delivery instanceof PushDelivery) {
                continue;
            }

            $status = $receipt['status'] ?? null;

            if ($status === 'ok') {
                $delivery->markDelivered();
                $deliveredCount++;
            } elseif ($status === 'error') {
                $errorType = isset($receipt['details']['error'])
                    ? (string) $receipt['details']['error']
                    : 'ReceiptError';
                $errorMessage = isset($receipt['message'])
                    ? (string) $receipt['message']
                    : 'Receipt reported delivery failure';

                $delivery->markFailed($errorType, $errorMessage);
                $failedCount++;

                if ($errorType === 'DeviceNotRegistered' && $delivery->deviceToken !== null) {
                    $delivery->deviceToken->revoke();
                    $deactivatedCount++;

                    Log::info('Deactivated device token from receipt DeviceNotRegistered', [
                        'user_id' => $delivery->user_id,
                        'ticket_id' => $ticketId,
                        'device_token_id' => $delivery->deviceToken->id,
                    ]);
                }
            }
        }

        return [
            'checked' => count($receipts),
            'delivered' => $deliveredCount,
            'failed' => $failedCount,
            'deactivated' => $deactivatedCount,
        ];
    }

    /**
     * Prunes push delivery records older than retention period (default 30 days).
     */
    public function pruneOldDeliveries(int $days = 30): int
    {
        return PushDelivery::query()
            ->where('created_at', '<', now()->subDays($days))
            ->delete();
    }
}
