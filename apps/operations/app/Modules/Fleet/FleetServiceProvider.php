<?php

namespace App\Modules\Fleet;

use Illuminate\Support\ServiceProvider;

/**
 * Fleet owns vehicle-specific capability evolution.
 *
 * Generic asset persistence, inspection, and maintenance remain in the shared
 * asset kernel while fleet and crane/equipment still use one table.
 */
final class FleetServiceProvider extends ServiceProvider {}
