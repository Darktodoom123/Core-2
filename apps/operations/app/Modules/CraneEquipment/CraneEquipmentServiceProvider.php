<?php

namespace App\Modules\CraneEquipment;

use Illuminate\Support\ServiceProvider;

/**
 * Crane and Equipment owns equipment-specific capability evolution.
 *
 * Generic asset persistence, inspection, and maintenance remain in the shared
 * asset kernel while fleet and crane/equipment still use one table.
 */
final class CraneEquipmentServiceProvider extends ServiceProvider {}
