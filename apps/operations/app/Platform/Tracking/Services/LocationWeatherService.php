<?php

namespace App\Platform\Tracking\Services;

use App\Platform\Weather\Services\LocationWeatherService as BaseLocationWeatherService;

/**
 * Backward compatibility alias.
 *
 * @deprecated Use \App\Platform\Weather\Services\LocationWeatherService instead.
 */
class LocationWeatherService extends BaseLocationWeatherService {}
