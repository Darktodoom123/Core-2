<?php

namespace App\Modules\Fuel\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Actions\MobileFuelContexts;
use App\Modules\Fuel\Actions\SubmitMobileFuelRequest;
use App\Modules\Fuel\Actions\TransitionFuelRequest;
use App\Modules\Fuel\Actions\WithdrawFuelRequest;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Http\Requests\StoreMobileFuelLog;
use App\Modules\Fuel\Http\Requests\StoreMobileFuelRequest;
use App\Modules\Fuel\Http\Resources\V1\FuelRequestResource;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

final class FuelRequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', FuelRequest::class);

        $fuelRequests = FuelRequest::query()
            ->visibleTo($request->user())
            ->with(['asset', 'job', 'logs'])
            ->latest()
            ->paginate(25);

        return FuelRequestResource::collection($fuelRequests)->response();
    }

    public function show(Request $request, FuelRequest $fuelRequest): JsonResponse
    {
        abort_unless(Gate::forUser($request->user())->allows('view', $fuelRequest), 404);

        return response()->json(['data' => new FuelRequestResource($fuelRequest->load(['asset', 'job', 'logs']))]);
    }

    public function store(
        StoreMobileFuelRequest $request,
        SubmitMobileFuelRequest $action,
        IdempotentCommandService $commands,
    ): Response {
        $payload = $request->validated();
        $commandId = $commands->resolveCommandId($request);

        if ($commandId !== null) {
            return $commands->process(
                $request->user(),
                $commandId,
                'fuel.request.create',
                null,
                function () use ($request, $action, $payload): JsonResponse {
                    $fuel = $action->handle($request->user(), $payload);

                    return response()->json(
                        ['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))],
                        $fuel->wasRecentlyCreated ? 201 : 200,
                    );
                },
                $payload,
            );
        }

        $fuel = $action->handle($request->user(), $payload);

        return response()->json(['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))], $fuel->wasRecentlyCreated ? 201 : 200);
    }

    public function record(
        StoreMobileFuelLog $request,
        FuelRequest $fuelRequest,
        TransitionFuelRequest $action,
        IdempotentCommandService $commands,
    ): Response {
        $payload = $request->validated();
        $commandId = $commands->resolveCommandId($request);

        if ($commandId !== null) {
            $receipt = $payload['receipt'] ?? null;
            unset($payload['receipt']);

            if ($receipt instanceof UploadedFile) {
                $receiptHash = hash_file('sha256', $receipt->getRealPath());
                if (! is_string($receiptHash)) {
                    throw ValidationException::withMessages([
                        'receipt' => ['The uploaded receipt could not be read safely.'],
                    ]);
                }
                $payload['receipt_sha256'] = $receiptHash;
            }

            return $commands->process(
                $request->user(),
                $commandId,
                "fuel.request.log:{$fuelRequest->id}",
                null,
                function () use ($request, $fuelRequest, $action): JsonResponse {
                    $fuel = $action->handle(
                        $request->user(),
                        $fuelRequest,
                        FuelRequestStatus::Logged,
                        null,
                        $request->validated(),
                    );

                    return response()->json(
                        ['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))],
                        201,
                    );
                },
                $payload,
                wrapInTransaction: ! ($receipt instanceof UploadedFile),
            );
        }

        $fuel = $action->handle($request->user(), $fuelRequest, FuelRequestStatus::Logged, null, $request->validated());

        return response()->json(['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))], 201);
    }

    public function withdraw(
        Request $request,
        FuelRequest $fuelRequest,
        WithdrawFuelRequest $action,
        IdempotentCommandService $commands,
    ): Response {
        abort_unless(Gate::forUser($request->user())->allows('view', $fuelRequest), 404);
        $payload = $request->validate(['reason' => ['nullable', 'string', 'max:2000']]);
        $respond = function () use ($request, $fuelRequest, $action, $payload): JsonResponse {
            $fuel = $action->handle($request->user(), $fuelRequest, $payload['reason'] ?? null);

            return response()->json(['data' => new FuelRequestResource($fuel->load(['asset', 'job', 'logs']))]);
        };
        $commandId = $commands->resolveCommandId($request);

        return $commandId !== null
            ? $commands->process($request->user(), $commandId, "fuel.request.withdraw:{$fuelRequest->id}", null, $respond, $payload)
            : $respond();
    }

    public function options(Request $request, MobileFuelContexts $contexts): JsonResponse
    {
        Gate::authorize('viewAny', FuelRequest::class);

        $assets = $contexts->assets($request->user())->orderBy('code')->get(['id', 'code', 'name', 'meter_type', 'meter_value']);
        $jobs = array_values($contexts->jobs($request->user())->with(['assetAssignments' => fn ($query) => $query->active()])->latest()->get()->map(fn (DispatchJob $job): array => [
            'id' => $job->id, 'reference' => $job->reference, 'title' => $job->title,
            'operational_asset_ids' => array_values($job->assetAssignments->map(fn (DispatchAssetAssignment $assignment): int => $assignment->operational_asset_id)->all()),
        ])->all());
        $assetIds = array_values($assets->map(fn (OperationalAsset $asset): int => $asset->id)->all());

        return response()->json(['data' => [
            'can_request' => $request->user()->can('create', FuelRequest::class),
            'assets' => $assets,
            'jobs' => $jobs,
            'defaults' => $this->defaultContext($request, $assetIds, $jobs),
        ]]);
    }

    /**
     * The operator's active shift wins; otherwise a single assignment is unambiguous.
     *
     * @param  list<int>  $assetIds
     * @param  list<array{id: int, reference: string, title: string, operational_asset_ids: list<int>}>  $jobs
     * @return array{operational_asset_id: int|null, dispatch_job_id: int|null}
     */
    private function defaultContext(Request $request, array $assetIds, array $jobs): array
    {
        $shift = OperatorShift::query()
            ->where('user_id', $request->user()->id)
            ->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK])
            ->latest('started_at')
            ->first(['operational_asset_id', 'dispatch_job_id']);

        $assetId = $shift?->operational_asset_id !== null && in_array($shift->operational_asset_id, $assetIds, true)
            ? $shift->operational_asset_id
            : (count($assetIds) === 1 ? $assetIds[0] : null);

        $candidateJobs = array_values(array_filter(
            $jobs,
            fn (array $job): bool => $assetId === null || in_array($assetId, $job['operational_asset_ids'], true),
        ));
        $jobIds = array_column($candidateJobs, 'id');

        $jobId = $shift?->dispatch_job_id !== null && in_array($shift->dispatch_job_id, $jobIds, true)
            ? $shift->dispatch_job_id
            : (count($jobIds) === 1 ? $jobIds[0] : null);

        return ['operational_asset_id' => $assetId, 'dispatch_job_id' => $jobId];
    }
}
