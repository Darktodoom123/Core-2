<?php

use App\Modules\Assignment\AssignmentServiceProvider;
use App\Modules\CraneEquipment\CraneEquipmentServiceProvider;
use App\Modules\Dispatch\DispatchServiceProvider;
use App\Modules\Fleet\FleetServiceProvider;
use App\Modules\Fuel\FuelServiceProvider;
use App\Modules\Rental\RentalServiceProvider;
use App\Modules\Sales\SalesServiceProvider;
use App\Platform\PlatformServiceProvider;
use App\Platform\Safety\SafetyServiceProvider;
use App\Platform\Tracking\TrackingServiceProvider;
use App\Providers\AppServiceProvider;
use App\Shared\Assets\AssetsServiceProvider;

return [
    AppServiceProvider::class,
    DispatchServiceProvider::class,
    AssignmentServiceProvider::class,
    RentalServiceProvider::class,
    SalesServiceProvider::class,
    FleetServiceProvider::class,
    CraneEquipmentServiceProvider::class,
    FuelServiceProvider::class,
    AssetsServiceProvider::class,
    PlatformServiceProvider::class,
    TrackingServiceProvider::class,
    SafetyServiceProvider::class,
];
