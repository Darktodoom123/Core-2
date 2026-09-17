<?php

namespace App\Modules\Rental\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Rental\Actions\RecordRentalHandoverEvidence;
use App\Modules\Rental\Http\Requests\SubmitRentalHandoverRequest;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\Response;

class RentalHandoverApiController extends Controller
{
    public function __construct(
        private readonly RecordRentalHandoverEvidence $recordEvidence,
        private readonly IdempotentCommandService $idempotentCommandService,
    ) {}

    public function submit(SubmitRentalHandoverRequest $request, RentalReservation $rentalReservation): Response
    {
        $user = $request->user();
        $attributes = $request->validated();
        if (empty($attributes['handover_type'])) {
            $attributes['handover_type'] = 'checkout';
        }

        $commandId = $this->idempotentCommandService->resolveCommandId($request);

        $execute = function () use ($rentalReservation, $user, $attributes): JsonResponse {
            $evidence = $this->recordEvidence->handle($rentalReservation, $user, $attributes);

            return response()->json([
                'message' => 'Rental handover evidence recorded successfully.',
                'data' => $evidence->toViewModel(),
            ], 201);
        };

        if ($commandId !== null) {
            return $this->idempotentCommandService->process(
                $user,
                $commandId,
                'rental.submit_handover',
                null,
                $execute,
                $request->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }

    public function checkout(SubmitRentalHandoverRequest $request, RentalReservation $rentalReservation): Response
    {
        $request->merge(['handover_type' => 'checkout']);

        return $this->submit($request, $rentalReservation);
    }

    public function returnReservation(SubmitRentalHandoverRequest $request, RentalReservation $rentalReservation): Response
    {
        $request->merge(['handover_type' => 'return']);

        return $this->submit($request, $rentalReservation);
    }
}
