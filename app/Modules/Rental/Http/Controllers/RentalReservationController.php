<?php

namespace App\Modules\Rental\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Rental\Actions\ApproveRentalReservation;
use App\Modules\Rental\Actions\AssignRentalOperator;
use App\Modules\Rental\Actions\AuthorizeRentalOperation;
use App\Modules\Rental\Actions\CheckoutRental;
use App\Modules\Rental\Actions\CreateRentalReservation;
use App\Modules\Rental\Actions\ReturnRental;
use App\Modules\Rental\Http\Requests\AssignRentalOperatorRequest;
use App\Modules\Rental\Http\Requests\AuthorizeRentalOperationRequest;
use App\Modules\Rental\Http\Requests\RentalConditionRequest;
use App\Modules\Rental\Http\Requests\StoreRentalReservationRequest;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

final class RentalReservationController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::RentalView->value);

        return response()->json(['data' => RentalReservation::query()->with(['client', 'items.asset', 'items.operatorAssignments.user:id,name', 'checkout', 'returnRecord'])->latest()->paginate(50)]);
    }

    public function store(StoreRentalReservationRequest $request, CreateRentalReservation $action): JsonResponse
    {
        $reservation = $action->handle($request->user(), $request->validated());

        return response()->json(['data' => $reservation], 201);
    }

    public function approve(RentalReservation $rentalReservation, ApproveRentalReservation $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($rentalReservation, request()->user())]);
    }

    public function assignOperator(RentalReservation $rentalReservation, AssignRentalOperatorRequest $request, AssignRentalOperator $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($request->user(), $rentalReservation, $request->toAttributes())]);
    }

    public function checkout(RentalReservation $rentalReservation, RentalConditionRequest $request, CheckoutRental $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($rentalReservation, $request->user(), $request->validated())]);
    }

    public function returnReservation(RentalReservation $rentalReservation, RentalConditionRequest $request, ReturnRental $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($rentalReservation, $request->user(), $request->validated())]);
    }

    public function authorizeOperation(RentalReservation $rentalReservation, AuthorizeRentalOperationRequest $request, AuthorizeRentalOperation $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($request->user(), $rentalReservation, (int) $request->validated('operational_asset_id'))]);
    }
}
