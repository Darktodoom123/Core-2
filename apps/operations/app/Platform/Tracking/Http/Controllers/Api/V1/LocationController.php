<?php

namespace App\Platform\Tracking\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Actions\BroadcastTrackingWorkspaceUpdate;
use App\Platform\Tracking\Actions\RecordLocationSample;
use App\Platform\Tracking\Http\Requests\StoreLocationBatchRequest;
use App\Platform\Tracking\Http\Requests\StoreLocationUpdateRequest;
use App\Platform\Tracking\Validation\LocationSampleRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator as ValidatorInstance;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class LocationController extends Controller
{
    public function store(
        StoreLocationUpdateRequest $request,
        IdempotentCommandService $idempotency,
        RecordLocationSample $record,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);
        $data = $request->validated();
        unset($data['command_id']);

        return $record->handle($request->user(), (string) $commandId, $data);
    }

    /**
     * Stores up to 50 pings in one request, so a phone that was offline sends
     * its backlog in a few requests instead of one per ping. Each ping is
     * checked and stored on its own under its own command id, and gets its own
     * answer; one refused ping never refuses the others.
     */
    public function storeBatch(
        StoreLocationBatchRequest $request,
        RecordLocationSample $record,
        BroadcastTrackingWorkspaceUpdate $broadcast,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();
        /** @var list<array<string, mixed>> $pings */
        $pings = $request->input('pings');
        $results = [];
        $stored = false;

        foreach ($pings as $ping) {
            $result = $this->storeOne($user, $ping, $record);
            $stored = $stored || ($result['status'] >= 200 && $result['status'] < 300);
            $results[] = $result;
        }

        if ($stored) {
            $broadcast->afterCommit();
        }

        return response()->json(['data' => $results]);
    }

    /**
     * @param  array<string, mixed>  $ping
     * @return array{command_id: string, status: int, message: string|null}
     */
    private function storeOne(User $user, array $ping, RecordLocationSample $record): array
    {
        $commandId = (string) $ping['command_id'];
        $input = LocationSampleRules::normalize($user, $ping);
        $validator = Validator::make($input, LocationSampleRules::rules());
        $validator->after(function (ValidatorInstance $validator) use ($user, $input): void {
            LocationSampleRules::after($validator, $user, $input);
        });

        if ($validator->fails()) {
            return ['command_id' => $commandId, 'status' => 422, 'message' => $validator->errors()->first()];
        }

        $data = $validator->validated();
        unset($data['command_id']);

        try {
            $response = $record->handle($user, $commandId, $data, broadcast: false);
        } catch (ValidationException $e) {
            return ['command_id' => $commandId, 'status' => 422, 'message' => $e->getMessage()];
        } catch (HttpExceptionInterface $e) {
            return ['command_id' => $commandId, 'status' => $e->getStatusCode(), 'message' => $e->getMessage()];
        } catch (Throwable $e) {
            report($e);

            return ['command_id' => $commandId, 'status' => 500, 'message' => 'The ping could not be stored. It will be sent again.'];
        }

        /** @var array<string, mixed> $body */
        $body = $response->getData(true);
        $message = $body['message'] ?? null;

        return [
            'command_id' => $commandId,
            'status' => $response->getStatusCode(),
            'message' => is_string($message) ? $message : null,
        ];
    }
}
