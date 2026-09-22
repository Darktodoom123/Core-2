<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Event location freshness
    |--------------------------------------------------------------------------
    |
    | Duty events are snapshots, not live tracking points. A GPS/browser fix
    | observed within this window is fresh; an older or explicitly last-known
    | observation remains visible but is never presented as current.
    |
    */
    'location_fresh_after_seconds' => 180,
    'location_max_future_skew_seconds' => 300,

    /*
    |--------------------------------------------------------------------------
    | Equipment usage policy
    |--------------------------------------------------------------------------
    |
    | Intentionally empty until a business-approved policy exists for an
    | equipment kind. HOS status selection must not become an equipment-meter
    | substitute. A policy may be added as, for example:
    |
    | 'mobile_crane' => ['statuses' => ['operating']],
    |
    | and is applied only to accepted, equipment-linked duty intervals.
    |
    */
    'equipment_usage_policies' => [],

    // Matches the existing tracking precision-retention requirement.
    'location_retention_days' => 30,
];
