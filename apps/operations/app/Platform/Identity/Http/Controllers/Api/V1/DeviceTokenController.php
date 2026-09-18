<?php

namespace App\Platform\Identity\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Http\Requests\RegisterDeviceTokenRequest;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Models\UserDeviceToken;
use App\Platform\Notifications\Models\PushDelivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

final class DeviceTokenController extends Controller
{
    public function register(RegisterDeviceTokenRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $validated = $request->validated();

        $installationId = (string) $validated['installation_id'];
        $token = (string) $validated['token'];
        $platform = (string) $validated['platform'];
        $provider = (string) ($validated['provider'] ?? 'expo');
        $appVersion = isset($validated['app_version']) ? (string) $validated['app_version'] : null;

        DB::transaction(function () use ($user, $installationId, $token, $platform, $provider, $appVersion): void {
            // Shared-device & token-rotation isolation:
            // Revoke any previous registrations on this device or with this token belonging to other accounts
            UserDeviceToken::query()
                ->where('user_id', '!=', $user->id)
                ->where(function ($query) use ($installationId, $token): void {
                    $query->where('installation_id', $installationId)
                        ->orWhere('token', $token);
                })
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'revoked_at' => now(),
                ]);

            // Upsert device token for current user and installation
            UserDeviceToken::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'installation_id' => $installationId,
                ],
                [
                    'token' => $token,
                    'platform' => $platform,
                    'provider' => $provider,
                    'app_version' => $appVersion,
                    'is_active' => true,
                    'revoked_at' => null,
                    'last_registered_at' => now(),
                ]
            );
        });

        return response()->json([
            'status' => 'registered',
            'installation_id' => $installationId,
        ], Response::HTTP_OK);
    }

    public function revoke(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $installationId = $request->input('installation_id') ?? $request->header('X-Installation-Id');
        $token = $request->input('token');
        $registeredBefore = $request->input('registered_before');

        if (! is_string($installationId) || trim($installationId) === '') {
            return response()->json([
                'message' => 'The installation_id field is required to revoke device token.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Only revoke tokens belonging to the authenticated user on this specific installation.
        // Protected against stale cleanup requests revoking newer account registrations.
        $query = UserDeviceToken::query()
            ->where('user_id', $user->id)
            ->where('installation_id', trim($installationId))
            ->where('is_active', true);

        if (is_string($token) && trim($token) !== '') {
            $query->where('token', trim($token));
        }

        if (is_string($registeredBefore) && trim($registeredBefore) !== '') {
            try {
                $query->where('last_registered_at', '<=', Carbon::parse($registeredBefore));
            } catch (\Throwable) {
                // Ignore parse errors on registeredBefore filter
            }
        }

        $query->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);

        return response()->json([
            'status' => 'revoked',
        ], Response::HTTP_OK);
    }

    public function recordOpened(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $ticketId = $request->input('ticket_id');
        $deliveryId = $request->input('delivery_id');

        if ((! is_string($ticketId) || trim($ticketId) === '') && (! is_numeric($deliveryId))) {
            return response()->json([
                'message' => 'A ticket_id or delivery_id is required.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $delivery = PushDelivery::query()
            ->when(is_string($ticketId) && trim($ticketId) !== '', fn ($q) => $q->where('ticket_id', trim($ticketId)))
            ->when(is_numeric($deliveryId), fn ($q) => $q->where('id', (int) $deliveryId))
            ->first();

        if (! $delivery instanceof PushDelivery) {
            return response()->json([
                'message' => 'Push delivery record not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ($delivery->user_id !== $user->id) {
            return response()->json([
                'message' => 'You are not authorized to update another user\'s push delivery.',
            ], Response::HTTP_FORBIDDEN);
        }

        $delivery->markOpened();

        return response()->json([
            'status' => 'acknowledged',
        ], Response::HTTP_OK);
    }
}
