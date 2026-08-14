<?php

namespace App\Modules\Dispatch\Enums;

enum DispatchV2CommandCode: string
{
    case FeatureDisabled = 'feature_disabled';
    case ObjectNotFound = 'object_not_found';
    case Forbidden = 'forbidden';
    case InvalidTransition = 'invalid_transition';
    case TerminalRecord = 'terminal_record';
    case ArchivedRecord = 'archived_record';
    case StaleVersion = 'stale_version';
    case MissingExpectedVersion = 'missing_expected_version';
    case IdempotencyPayloadMismatch = 'idempotency_payload_mismatch';
    case IdempotencyConflict = 'idempotency_conflict';
    case IdempotencyInProgress = 'idempotency_in_progress';
    case NotReady = 'not_ready';
    case InvalidReason = 'invalid_reason';
    case InvalidCommand = 'invalid_command';
}
