/**
 * Presentation-only status labels accepted by the shared status badge.
 * Live and persisted status contracts belong to workspace.ts.
 */
export type PrototypeDispatchStatusLabel =
    | 'Draft'
    | 'Scheduled'
    | 'Dispatched'
    | 'En route'
    | 'Arrived'
    | 'In progress'
    | 'On hold'
    | 'Completed'
    | 'Cancelled';

export type TelemetryFreshness = 'Live' | 'Delayed' | 'Stale' | 'Offline';
