<?php

namespace App\Modules\Sales\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Sales\Actions\RecordSalesDeliveryEvidence;
use App\Modules\Sales\Http\Requests\SubmitSalesDeliveryRequest;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class SalesDeliveryApiController extends Controller
{
    public function __construct(
        private readonly RecordSalesDeliveryEvidence $recordEvidence,
        private readonly IdempotentCommandService $idempotentCommandService,
    ) {}

    public function submit(SubmitSalesDeliveryRequest $request, SalesOrder $salesOrder): Response
    {
        $user = $request->user();
        $attributes = $request->validated();

        $commandId = $this->idempotentCommandService->resolveCommandId($request);

        $execute = function () use ($salesOrder, $user, $attributes): JsonResponse {
            $evidence = $this->recordEvidence->handle($salesOrder, $user, $attributes);

            return response()->json([
                'message' => 'Sales delivery evidence recorded successfully.',
                'data' => $evidence->toViewModel(),
            ], 201);
        };

        if ($commandId !== null) {
            return $this->idempotentCommandService->process(
                $user,
                $commandId,
                'sales.submit_delivery',
                null,
                $execute,
                $request->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }
}
