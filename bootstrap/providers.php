<?php

use App\Modules\Assignment\AssignmentServiceProvider;
use App\Modules\CraneEquipment\CraneEquipmentServiceProvider;
use App\Modules\Dispatch\DispatchServiceProvider;
use App\Modules\Fleet\FleetServiceProvider;
use App\Modules\Fuel\FuelServiceProvider;
use App\Platform\PlatformServiceProvider;
use App\Platform\Tracking\TrackingServiceProvider;
use App\Providers\AppServiceProvider;
use App\Shared\Assets\AssetsServiceProvider;

return [
    AppServiceProvider::class,
    DispatchServiceProvider::class,
    AssignmentServiceProvider::class,
    FleetServiceProvider::class,
    CraneEquipmentServiceProvider::class,
    FuelServiceProvider::class,
    AssetsServiceProvider::class,
    PlatformServiceProvider::class,
    TrackingServiceProvider::class,
];
