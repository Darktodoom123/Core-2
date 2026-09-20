import type {
    CommandErrorDetails,
    OutboxCommand,
    OutboxCommandState,
    OutboxCommandType,
} from '../types/index';

export type SyncPillTone =
    'online' | 'offline' | 'checking' | 'attention' | 'syncing';

export interface OutboxItemDisplay {
    id: string;
    type: OutboxCommandType;
    title: string;
    subtitle: string;
    reference: string;
    state: OutboxCommandState;
    stateLabel: string;
    stateTone:
        | 'queued'
        | 'syncing'
        | 'failed'
        | 'conflict'
        | 'completed'
        | 'expired'
        | 'unresolved';
    explanation: string;
    stage?: string | null;
    attempts: number;
    retryable: boolean;
    canDiscard: boolean;
    discardBlockReason?: string;
    isUncertainOutcome: boolean;
    isQuarantined: boolean;
    isConflict: boolean;
    canRetryWithVersion: boolean;
    serverReference?: string;
    serverStatusLabel?: string;
    isCancelledOnServer: boolean;
    isCompletedOnServer: boolean;
    isMissingAttachments: boolean;
    missingAttachmentUri?: string;
    isAuthenticationRequired: boolean;
    isAuthorizationDenied: boolean;
    isValidationFailed: boolean;
    isEmergency: boolean;
    isTelemetry: boolean;
    attachmentCount: number;
    currentVersion?: number;
    createdAt: string;
    formattedCreatedAt: string;
    lastAttemptAt?: string | null;
    formattedLastAttempt?: string | null;
    nextAttemptAt?: string | null;
    nextRetryDelaySeconds?: number | null;
    completedAt?: string | null;
    formattedCompletedAt?: string | null;
    rawError?: CommandErrorDetails | null;
}

export interface TelemetryGroupSummary {
    count: number;
    oldestTimestamp: string;
    latestTimestamp: string;
    state: 'queued' | 'syncing' | 'failed';
    samplePings: OutboxItemDisplay[];
}

export interface OutboxProjection {
    isOnline: boolean | null;
    isAuthenticated: boolean;
    isProcessing: boolean;
    lastSuccessfulSyncAt?: string | null;
    headerPill: {
        label: string;
        message: string;
        tone: SyncPillTone;
        accessibilityLabel: string;
    };
    counts: {
        total: number;
        waiting: number; // Queued user actions (excluding telemetry)
        submitting: number; // Syncing user actions
        attention: number; // Failed, conflict, or expired
        completed: number; // Recently completed
        telemetry: number; // Queued/syncing location share samples
        totalActive: number; // Non-completed user actions needing transfer
    };
    sections: {
        attention: OutboxItemDisplay[];
        active: OutboxItemDisplay[];
        telemetry: TelemetryGroupSummary | null;
        recentCompleted: OutboxItemDisplay[];
    };
    canSyncNow: boolean;
    syncGuidance: string;
}

export function formatTimeShort(isoDateString?: string | null): string {
    if (!isoDateString) {
        return '';
    }

    const date = new Date(isoDateString);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    try {
        return date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

export function formatDateTimeShort(isoDateString?: string | null): string {
    if (!isoDateString) {
        return '';
    }

    const date = new Date(isoDateString);

    if (Number.isNaN(date.getTime())) {
        return '';
    }

    try {
        const time = date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        const monthDay = date.toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
        });

        return `${monthDay}, ${time}`;
    } catch {
        return '';
    }
}

export function getHumanReadableActionType(cmd: OutboxCommand): {
    title: string;
    reference: string;
    subtitle: string;
    attachmentCount: number;
    isEmergency: boolean;
    isTelemetry: boolean;
} {
    const payload = cmd.payload || {};
    let title = 'Field Action';
    let reference = '';
    let subtitle = '';
    let attachmentCount = 0;
    let isEmergency = cmd.priority === 'emergency';
    let isTelemetry = false;

    switch (cmd.type) {
        case 'activate_sos': {
            isEmergency = true;
            const category =
                typeof payload.category === 'string'
                    ? payload.category.replaceAll('_', ' ')
                    : 'Distress Signal';
            title = 'Emergency SOS Alert';
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'Immediate Danger';
            subtitle = `Category: ${category}`;
            break;
        }

        case 'submit_dvir': {
            const inspType =
                payload.inspection_type === 'post_trip'
                    ? 'Post-Trip'
                    : 'Pre-Trip';
            const assetCode =
                typeof payload.asset_code === 'string'
                    ? payload.asset_code
                    : cmd.jobId
                      ? `Job #${cmd.jobId}`
                      : 'Vehicle';
            title = `${inspType} DVIR Inspection`;
            reference = `Asset ${assetCode}`;
            subtitle = payload.has_defects
                ? 'Defects reported · Safety lockout'
                : 'Walkaround checklist cleared';

            if (Array.isArray(payload.photos)) {
                attachmentCount = payload.photos.length;
            }

            break;
        }

        case 'submit_equipment_inspection': {
            const inspType =
                typeof payload.type === 'string'
                    ? payload.type.replaceAll('_', ' ')
                    : 'Safety & Mechanical';
            const assetId = payload.operational_asset_id ?? cmd.jobId;
            title = 'Equipment Inspection';
            reference = assetId ? `Asset #${assetId}` : 'Heavy Equipment';
            subtitle = `Type: ${inspType}`;

            if (Array.isArray(payload.photos)) {
                attachmentCount = payload.photos.length;
            } else if (Array.isArray(payload.attachments)) {
                attachmentCount = payload.attachments.length;
            }

            break;
        }

        case 'submit_maintenance_work_order': {
            const assetId = payload.operational_asset_id ?? cmd.jobId;
            const defect =
                typeof payload.defect === 'string'
                    ? payload.defect
                    : 'Mechanical fault';
            title = 'Maintenance Work Order';
            reference = assetId ? `Asset #${assetId}` : 'Work Order';
            subtitle = defect.length > 36 ? `${defect.slice(0, 36)}…` : defect;

            if (Array.isArray(payload.attachments)) {
                attachmentCount = payload.attachments.length;
            }

            break;
        }

        case 'release_maintenance_work_order': {
            title = 'Maintenance Work Order Release';
            reference = payload.maintenance_work_order_id
                ? `WO #${payload.maintenance_work_order_id}`
                : 'Quarantined Action';
            subtitle = 'Offline release permanently disallowed';
            break;
        }

        case 'submit_rental_handover': {
            const hType =
                payload.handover_type === 'return'
                    ? 'Return Check-in'
                    : 'Checkout Delivery';
            const resId = payload.reservation_id ?? cmd.jobId;
            title = `Rental Handover (${hType})`;
            reference = resId ? `Reservation REN-${resId}` : 'Rental Asset';
            subtitle =
                typeof payload.signee_name === 'string'
                    ? `Signed by: ${payload.signee_name}`
                    : 'Equipment custody verification';

            if (Array.isArray(payload.photos)) {
                attachmentCount = payload.photos.length;
            }

            break;
        }

        case 'submit_sales_delivery': {
            const orderId = payload.order_id ?? cmd.jobId;
            title = 'Sales Equipment Delivery';
            reference = orderId ? `Order SO-${orderId}` : 'Sales Order';
            subtitle =
                typeof payload.verified_vin === 'string'
                    ? `VIN: ${payload.verified_vin}`
                    : 'Delivery acceptance proof';

            if (Array.isArray(payload.photos)) {
                attachmentCount = payload.photos.length;
            }

            break;
        }

        case 'report_delay': {
            const stage =
                typeof payload.delay_stage === 'string'
                    ? payload.delay_stage.replaceAll('_', ' ')
                    : 'Execution';
            const reason =
                typeof payload.reason === 'string'
                    ? payload.reason.replaceAll('_', ' ')
                    : 'Site delay';
            title = 'Delay Report';
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'Field Dispatch';
            subtitle = `${stage} — ${reason}`;
            break;
        }

        case 'submit_job_report': {
            title = 'Daily Job Report';
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'Dispatch';
            const summary =
                typeof payload.work_summary === 'string'
                    ? payload.work_summary
                    : 'Work completed';
            subtitle =
                summary.length > 36 ? `${summary.slice(0, 36)}…` : summary;
            break;
        }

        case 'transition_status': {
            const targetStatus =
                typeof payload.status === 'string'
                    ? payload.status.replaceAll('_', ' ')
                    : 'Updated';
            title = 'Status Transition';
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'Dispatch Job';
            subtitle = `Progressing to: ${targetStatus}`;
            break;
        }

        case 'respond_assignment': {
            const response =
                payload.response === 'accepted' ? 'Accepted' : 'Declined';
            title = `Dispatch Response (${response})`;
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'Assignment';
            subtitle =
                typeof payload.reason === 'string' && payload.reason
                    ? `Reason: ${payload.reason}`
                    : `Operator ${response.toLowerCase()} assignment`;
            break;
        }

        case 'share_location': {
            isTelemetry = true;
            title = 'Location Sharing Ping';
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'GPS Telemetry';
            const lat =
                typeof payload.latitude === 'number'
                    ? payload.latitude.toFixed(4)
                    : '';
            const lon =
                typeof payload.longitude === 'number'
                    ? payload.longitude.toFixed(4)
                    : '';
            subtitle =
                lat && lon
                    ? `Coords: ${lat}, ${lon}`
                    : 'Background GPS broadcast';
            break;
        }

        default: {
            title = `Action: ${String(cmd.type).replaceAll('_', ' ')}`;
            reference = cmd.jobId ? `Job #${cmd.jobId}` : 'Local Outbox';
            subtitle = 'Unrecognized action type';
            break;
        }
    }

    return {
        title,
        reference,
        subtitle,
        attachmentCount,
        isEmergency,
        isTelemetry,
    };
}

export function isCommandDiscardable(
    command: OutboxCommand,
    allCommands?: OutboxCommand[],
): { canDiscard: boolean; reason?: string } {
    if (command.state === 'completed') {
        return {
            canDiscard: false,
            reason: 'Completed actions have already been synced to dispatch.',
        };
    }

    if (command.state === 'syncing') {
        return {
            canDiscard: false,
            reason: 'Cannot discard an action while it is syncing.',
        };
    }

    if (command.state === 'unresolved') {
        return {
            canDiscard: false,
            reason: 'This action has an unresolved server outcome. Preserve its evidence until central dispatch reconciles the original command.',
        };
    }

    if (command.type === 'activate_sos' && command.state !== 'expired') {
        return {
            canDiscard: false,
            reason: 'Active emergency SOS cannot be discarded.',
        };
    }

    const payload = (command.payload || {}) as Record<string, unknown>;

    // Safety DVIR inspection with critical defects / lockout cannot be discarded
    if (
        command.type === 'submit_dvir' &&
        (payload.has_defects === true ||
            payload.hasDefects === true ||
            payload.safety_status === 'unsafe' ||
            payload.status === 'unsafe' ||
            payload.defect_severity === 'critical' ||
            payload.has_critical_defects === true ||
            (Array.isArray(payload.defects) && payload.defects.length > 0))
    ) {
        return {
            canDiscard: false,
            reason: 'Safety DVIR inspections reporting defects cannot be discarded locally.',
        };
    }

    // Failed equipment inspection cannot be discarded
    if (
        command.type === 'submit_equipment_inspection' &&
        (payload.result === 'failed' ||
            payload.status === 'failed' ||
            payload.passed === false ||
            payload.has_defects === true ||
            payload.hasDefects === true ||
            payload.defect_severity === 'critical' ||
            (Array.isArray(payload.defects) && payload.defects.length > 0))
    ) {
        return {
            canDiscard: false,
            reason: 'Equipment inspections with defects cannot be discarded locally.',
        };
    }

    // Maintenance work order cannot be discarded
    if (command.type === 'submit_maintenance_work_order') {
        return {
            canDiscard: false,
            reason: 'Maintenance work orders cannot be discarded locally.',
        };
    }

    // Signed customer handovers cannot be discarded
    if (
        (command.type === 'submit_rental_handover' ||
            command.type === 'submit_sales_delivery') &&
        Boolean(
            payload.signee_name ||
            payload.signature_image_path ||
            payload.signature,
        )
    ) {
        return {
            canDiscard: false,
            reason: 'Signed custody handovers cannot be discarded.',
        };
    }

    // Check for dependent uncompleted commands for the same job
    if (allCommands && command.jobId !== null && command.jobId !== undefined) {
        const hasDependent = allCommands.some(
            (c) =>
                c.jobId === command.jobId &&
                c.id !== command.id &&
                (Date.parse(c.createdAt) > Date.parse(command.createdAt) ||
                    (Date.parse(c.createdAt) ===
                        Date.parse(command.createdAt) &&
                        c.id.localeCompare(command.id) > 0)) &&
                (c.state === 'queued' ||
                    c.state === 'syncing' ||
                    (c.state === 'failed' && c.error?.retryable === true)),
        );

        if (hasDependent) {
            return {
                canDiscard: false,
                reason: 'Cannot discard this action because subsequent dependent actions exist for this job.',
            };
        }
    }

    return { canDiscard: true };
}

export function isServerOutcomeUncertain(command: OutboxCommand): boolean {
    if (command.state === 'unresolved') {
        return true;
    }

    if (command.attempts <= 0) {
        return false;
    }

    if (command.state === 'completed') {
        return false;
    }

    const error = command.error;

    if (!error) {
        return false;
    }

    if (
        error.code === 'TIMEOUT' ||
        error.code === 'GATEWAY_TIMEOUT' ||
        error.code === 'NETWORK_ERROR' ||
        error.code === 'NETWORK_TIMEOUT' ||
        error.code === 'NETWORK_RETRY_SCHEDULED' ||
        error.code === 'OUTCOME_UNRESOLVED' ||
        error.code === 'UNKNOWN_ERROR'
    ) {
        return true;
    }

    if (
        typeof error.status === 'number' &&
        [408, 502, 503, 504].includes(error.status)
    ) {
        return true;
    }

    if (typeof error.message === 'string') {
        const msg = error.message.toLowerCase();

        if (
            msg.includes('timeout') ||
            msg.includes('timed out') ||
            msg.includes('gateway') ||
            msg.includes('network request failed') ||
            msg.includes('econnreset') ||
            msg.includes('uncertain')
        ) {
            return true;
        }
    }

    return false;
}

export function projectCommandToDisplay(
    cmd: OutboxCommand,
    isOnline: boolean | null,
    now = Date.now(),
    allCommands?: OutboxCommand[],
): OutboxItemDisplay {
    const meta = getHumanReadableActionType(cmd);
    const errorCode = cmd.error?.code;
    const isQuarantined =
        cmd.type === 'release_maintenance_work_order' ||
        errorCode === 'LEGACY_RELEASE_DISALLOWED' ||
        errorCode === 'MALFORMED_COMMAND' ||
        errorCode === 'UNKNOWN_COMMAND_TYPE' ||
        errorCode === 'QUARANTINED';
    const isConflict =
        cmd.state === 'conflict' || errorCode === 'stale_version';
    const isUnresolved =
        cmd.state === 'unresolved' || errorCode === 'OUTCOME_UNRESOLVED';
    const isMissingAttachments = errorCode === 'MISSING_ATTACHMENTS';
    const missingAttachmentUri = cmd.error?.missingAttachmentUri;
    const isAuthenticationRequired = errorCode === 'AUTHENTICATION_REQUIRED';
    const isAuthorizationDenied = errorCode === 'AUTHORIZATION_DENIED';
    const isValidationFailed =
        errorCode === 'VALIDATION_FAILED' ||
        errorCode === 'UNPROCESSABLE_ENTITY';

    const serverSnapshot = cmd.error?.serverSnapshot;
    const isCancelledOnServer = serverSnapshot?.status?.value === 'cancelled';
    const isCompletedOnServer = serverSnapshot?.status?.value === 'completed';
    const canRetryWithVersion =
        isConflict &&
        !isCancelledOnServer &&
        !isCompletedOnServer &&
        typeof cmd.error?.currentVersion === 'number' &&
        cmd.error.currentVersion > (cmd.expectedVersion ?? 0);
    const serverReference = serverSnapshot?.reference;
    const serverStatusLabel = serverSnapshot?.status?.label;

    const discardCheck = isCommandDiscardable(cmd, allCommands);
    const canDiscard = discardCheck.canDiscard;
    const discardBlockReason = discardCheck.reason;
    const isUncertainOutcome = isServerOutcomeUncertain(cmd);

    let stateLabel = 'Waiting to sync';
    let stateTone: OutboxItemDisplay['stateTone'] = 'queued';
    let explanation = '';
    let retryable = false;

    if (cmd.state === 'completed') {
        stateLabel = 'Synced';
        stateTone = 'completed';
        explanation =
            'Acknowledged and safely stored on central dispatch server.';
        retryable = false;
    } else if (cmd.state === 'syncing') {
        stateLabel = cmd.stage
            ? cmd.stageMessage || 'Submitting to dispatch'
            : 'Syncing';
        stateTone = 'syncing';
        explanation =
            'Transferring action data to server. Taps disabled while in flight.';
        retryable = false;
    } else if (cmd.state === 'conflict' || isConflict) {
        stateLabel = 'Version conflict';
        stateTone = 'conflict';

        if (isCancelledOnServer) {
            explanation =
                'Job was cancelled on central dispatch server. This action cannot be retried.';
        } else if (isCompletedOnServer) {
            explanation =
                'Job was completed on central dispatch server. This action cannot be retried.';
        } else if (!canDiscard && discardBlockReason) {
            const nextAction =
                canRetryWithVersion &&
                typeof cmd.error?.currentVersion === 'number'
                    ? `Retry with server version v${cmd.error.currentVersion} to reconcile submitted evidence.`
                    : 'Evidence is preserved locally. Contact central dispatch to review and reconcile.';
            explanation = `${discardBlockReason} Required next action: ${nextAction}`;
        } else if (serverReference && serverStatusLabel) {
            explanation = `Central dispatch updated this job (${serverReference} — ${serverStatusLabel}). Review and reconcile before proceeding.`;
        } else {
            explanation =
                'Server state was updated by another operator or dispatcher. Review and reconcile before proceeding.';
        }

        retryable = false;
    } else if (cmd.state === 'expired' || errorCode === 'SOS_EXPIRED') {
        stateLabel = 'Emergency alert expired';
        stateTone = 'expired';
        explanation =
            'SOS delivery timed out without server acknowledgement. Do NOT wait — contact emergency dispatch or supervisor via radio or phone.';
        retryable = false;
    } else if (isUnresolved) {
        stateLabel = 'Outcome unresolved';
        stateTone = 'unresolved';
        explanation =
            cmd.error?.message ||
            'The original request may have reached central dispatch. Reconcile it before changing or discarding its evidence.';
        // Replaying the unchanged payload with the original command ID is the
        // only safe automatic action while the outcome is unresolved.
        retryable = !cmd.error?.missingAttachmentUri;
    } else if (cmd.state === 'failed') {
        stateTone = 'failed';

        if (isQuarantined) {
            stateLabel = 'Quarantined (cannot replay)';
            explanation =
                cmd.error?.message ||
                'Offline work order release commands are deprecated and cannot be replayed. An explicit online release is required.';
            retryable = false;
        } else if (isAuthenticationRequired) {
            stateLabel = 'Sign-in required';
            explanation =
                'Your session has expired. Sign in again under this account to resume syncing.';
            retryable = true;
        } else if (isAuthorizationDenied) {
            stateLabel = 'Unauthorized';
            explanation =
                'This account lacks permission to perform this action. Contact dispatch or discard.';
            retryable = false;
        } else if (isValidationFailed) {
            stateLabel = 'Submission rejected';
            explanation =
                cmd.error?.message ||
                'The server rejected the submitted form data. Please discard and re-enter valid details.';
            retryable = false;
        } else if (errorCode === 'MISSING_ATTACHMENTS') {
            stateLabel = 'Missing photo files';
            explanation =
                cmd.error?.message ||
                'Required photo attachment is missing from device storage. Please recapture or discard.';
            retryable = false;
        } else if (errorCode === 'RETRY_EXHAUSTED') {
            stateLabel = 'Retry limit reached';
            explanation = `Automatic retry limit reached (${cmd.attempts} attempts). Review connection and retry manually.`;
            retryable = true;
        } else {
            stateLabel = 'Failed';
            explanation =
                cmd.error?.message ||
                'The server rejected this action or the connection timed out.';
            retryable = cmd.error?.retryable === true;
        }
    } else {
        // state === 'queued'
        stateTone = 'queued';

        const nextTime = cmd.nextAttemptAt ? Date.parse(cmd.nextAttemptAt) : 0;
        const remainingMs = nextTime - now;

        if (meta.isEmergency) {
            stateLabel =
                isOnline === false
                    ? 'Offline — SOS unsent'
                    : 'SOS queued (unacknowledged)';
            explanation =
                'Distress signal NOT yet received or acknowledged by responders. If in immediate danger, use emergency voice radio or phone now.';
            retryable = isOnline !== false;
        } else if (errorCode === 'RATE_LIMITED' && remainingMs > 0) {
            stateLabel = `Retry scheduled in ${Math.ceil(remainingMs / 1000)}s`;
            explanation =
                'Server rate limit reached. Waiting for scheduled window before retrying.';
            retryable = false;
        } else if (remainingMs > 0) {
            stateLabel = `Retry in ${Math.ceil(remainingMs / 1000)}s`;
            explanation = `Connection unavailable on attempt ${cmd.attempts}. Scheduled retry in progress.`;
            retryable = false;
        } else if (isOnline === false) {
            stateLabel = 'Waiting for connection';
            stateTone = 'queued';
            explanation =
                'Saved securely on this phone. Will upload automatically when connectivity returns.';
            retryable = false;
        } else {
            stateLabel = 'Waiting to sync';
            explanation = 'Ready for upload. Synchronization in progress.';
            retryable = true;
        }
    }

    let nextRetryDelaySeconds: number | null = null;

    if (cmd.nextAttemptAt) {
        const diffMs = Date.parse(cmd.nextAttemptAt) - now;

        if (diffMs > 0) {
            nextRetryDelaySeconds = Math.ceil(diffMs / 1000);
        }
    }

    return {
        id: cmd.id,
        type: cmd.type,
        title: meta.title,
        subtitle: meta.subtitle,
        reference: meta.reference,
        state: cmd.state,
        stateLabel,
        stateTone,
        explanation,
        stage: cmd.stageMessage || cmd.stage,
        attempts: cmd.attempts,
        retryable,
        canDiscard,
        discardBlockReason,
        isUncertainOutcome,
        isQuarantined,
        isConflict,
        canRetryWithVersion,
        serverReference,
        serverStatusLabel,
        isCancelledOnServer,
        isCompletedOnServer,
        isMissingAttachments,
        missingAttachmentUri,
        isAuthenticationRequired,
        isAuthorizationDenied,
        isValidationFailed,
        isEmergency: meta.isEmergency,
        isTelemetry: meta.isTelemetry,
        attachmentCount: meta.attachmentCount,
        currentVersion: cmd.error?.currentVersion,
        createdAt: cmd.createdAt,
        formattedCreatedAt: formatDateTimeShort(cmd.createdAt),
        lastAttemptAt: cmd.lastAttemptAt,
        formattedLastAttempt: formatTimeShort(cmd.lastAttemptAt),
        nextAttemptAt: cmd.nextAttemptAt,
        nextRetryDelaySeconds,
        completedAt: cmd.completedAt,
        formattedCompletedAt: formatTimeShort(cmd.completedAt),
        rawError: cmd.error,
    };
}

export function projectOutbox(
    commands: OutboxCommand[],
    isOnline: boolean | null,
    isAuthenticated = true,
    now?: number,
    lastSuccessfulSyncAt?: string | null,
): OutboxProjection {
    const currentNow = typeof now === 'number' ? now : Date.now();
    const displays = commands.map((c) =>
        projectCommandToDisplay(c, isOnline, currentNow, commands),
    );

    const attentionItems: OutboxItemDisplay[] = [];
    const activeItems: OutboxItemDisplay[] = [];
    const telemetryItems: OutboxItemDisplay[] = [];
    const completedItems: OutboxItemDisplay[] = [];

    for (const item of displays) {
        if (item.state === 'completed') {
            completedItems.push(item);
        } else if (
            item.state === 'failed' ||
            item.state === 'conflict' ||
            item.state === 'expired' ||
            item.state === 'unresolved'
        ) {
            attentionItems.push(item);
        } else if (item.isTelemetry) {
            telemetryItems.push(item);
        } else {
            activeItems.push(item);
        }
    }

    // Sort active items: emergency first, then oldest created
    activeItems.sort((a, b) => {
        const prioA = a.isEmergency ? 0 : 1;
        const prioB = b.isEmergency ? 0 : 1;

        if (prioA !== prioB) {
            return prioA - prioB;
        }

        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });

    // Sort attention items: emergency first, then latest updated
    attentionItems.sort((a, b) => {
        const prioA = a.isEmergency ? 0 : 1;
        const prioB = b.isEmergency ? 0 : 1;

        if (prioA !== prioB) {
            return prioA - prioB;
        }

        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });

    // Sort completed items: latest completed first, bounded to 5 items
    completedItems.sort((a, b) => {
        const timeA = a.completedAt ? Date.parse(a.completedAt) : 0;
        const timeB = b.completedAt ? Date.parse(b.completedAt) : 0;

        return timeB - timeA;
    });
    const boundedCompleted = completedItems.slice(0, 5);

    // Group telemetry
    let telemetrySummary: TelemetryGroupSummary | null = null;

    if (telemetryItems.length > 0) {
        const oldest = telemetryItems[0]?.formattedCreatedAt || '';
        const latest =
            telemetryItems[telemetryItems.length - 1]?.formattedCreatedAt || '';
        const hasSyncing = telemetryItems.some((t) => t.state === 'syncing');
        const hasFailed = telemetryItems.some((t) => t.state === 'failed');
        const state = hasSyncing ? 'syncing' : hasFailed ? 'failed' : 'queued';

        telemetrySummary = {
            count: telemetryItems.length,
            oldestTimestamp: oldest,
            latestTimestamp: latest,
            state,
            samplePings: telemetryItems.slice(0, 3),
        };
    }

    const waitingUserActions = activeItems.filter(
        (i) => i.state === 'queued',
    ).length;
    const submittingUserActions = activeItems.filter(
        (i) => i.state === 'syncing',
    ).length;
    const attentionCount = attentionItems.length;
    const completedCount = completedItems.length;
    const telemetryCount = telemetryItems.length;
    const totalActive =
        waitingUserActions + submittingUserActions + attentionCount;
    const isProcessing =
        submittingUserActions > 0 || telemetrySummary?.state === 'syncing';

    // Truthful header pill computation:
    // Priority 1: Attention required (failures, conflicts, expired)
    // Priority 2: Submitting / Syncing
    // Priority 3: Waiting to sync / Scheduled retry
    // Priority 4: All synced or Offline
    let pillLabel = 'Synced';
    let pillMessage = 'Just now';
    let pillTone: SyncPillTone = 'online';

    if (!isAuthenticated) {
        pillLabel =
            attentionCount > 0
                ? `${attentionCount} need${attentionCount === 1 ? 's' : ''} attention`
                : 'Sign in required';
        pillMessage = 'Session expired';
        pillTone = 'attention';
    } else if (attentionCount > 0) {
        pillLabel = `${attentionCount} need${attentionCount === 1 ? 's' : ''} attention`;
        pillMessage = 'Tap to review outbox';
        pillTone = 'attention';
    } else if (submittingUserActions > 0) {
        const totalSubmittingAndWaiting =
            submittingUserActions + waitingUserActions;
        pillLabel =
            totalSubmittingAndWaiting > 1
                ? `Syncing 1 of ${totalSubmittingAndWaiting}`
                : 'Syncing action';
        pillMessage =
            activeItems.find((i) => i.state === 'syncing')?.stage ||
            'Submitting to dispatch';
        pillTone = 'syncing';
    } else if (waitingUserActions > 0) {
        if (isOnline === false) {
            pillLabel = `Offline (${waitingUserActions} waiting)`;
            pillMessage = 'Reconnect to sync';
            pillTone = 'offline';
        } else {
            pillLabel = `${waitingUserActions} waiting to sync`;
            pillMessage = 'Actions queued locally';
            pillTone = 'checking';
        }
    } else if (telemetryCount > 0) {
        if (isOnline === false) {
            pillLabel = 'Offline';
            pillMessage = `${telemetryCount} GPS pings saved`;
            pillTone = 'offline';
        } else {
            pillLabel = `${telemetryCount} GPS ping${telemetryCount === 1 ? '' : 's'} queued`;
            pillMessage = 'Background telemetry';
            pillTone = 'checking';
        }
    } else {
        // Zero active items
        if (isOnline === false) {
            pillLabel = 'Offline';
            pillMessage = 'Reconnect to sync';
            pillTone = 'offline';
        } else if (isOnline === null) {
            pillLabel = 'Checking connection';
            pillMessage = 'Checking…';
            pillTone = 'checking';
        } else if (lastSuccessfulSyncAt) {
            const syncTime = Date.parse(lastSuccessfulSyncAt);
            const diffMs = !Number.isNaN(syncTime)
                ? Math.max(0, currentNow - syncTime)
                : 0;

            if (diffMs < 60_000) {
                pillLabel = 'Synced';
                pillMessage = 'Just now';
            } else if (diffMs < 3_600_000) {
                const mins = Math.floor(diffMs / 60_000);
                pillLabel = 'Synced';
                pillMessage = `${mins}m ago`;
            } else {
                pillLabel = 'Synced';
                pillMessage = formatDateTimeShort(lastSuccessfulSyncAt);
            }

            pillTone = 'online';
        } else {
            pillLabel = 'Synced';
            pillMessage = 'Up to date';
            pillTone = 'online';
        }
    }

    const accessibilityLabel = `Sync status: ${pillLabel}, ${pillMessage}`;

    // Guidance text
    let syncGuidance =
        'Actions sync automatically when connection is available.';

    if (!isAuthenticated) {
        syncGuidance = 'Sign-in required to sync saved actions with dispatch.';
    } else if (attentionCount > 0) {
        const conflicts = attentionItems.filter((i) => i.isConflict).length;
        const unresolved = attentionItems.filter(
            (i) => i.state === 'unresolved',
        ).length;
        const failed = attentionItems.filter(
            (i) => !i.isConflict && i.state !== 'unresolved',
        ).length;
        const otherAttention = failed + unresolved;

        if (conflicts > 0 && otherAttention > 0) {
            if (unresolved === 0) {
                syncGuidance = `${conflicts} conflict${conflicts === 1 ? '' : 's'} and ${failed} failed action${failed === 1 ? '' : 's'} need attention.`;
            } else if (failed > 0) {
                syncGuidance = `${conflicts} conflict${conflicts === 1 ? '' : 's'}, ${failed} failed action${failed === 1 ? '' : 's'} and ${unresolved} unresolved outcome${unresolved === 1 ? '' : 's'} need attention.`;
            } else {
                syncGuidance = `${conflicts} conflict${conflicts === 1 ? '' : 's'} and ${unresolved} unresolved outcome${unresolved === 1 ? '' : 's'} need attention.`;
            }
        } else if (conflicts > 0) {
            syncGuidance = `${conflicts} saved action${conflicts === 1 ? '' : 's'} need conflict review.`;
        } else if (unresolved > 0 && failed > 0) {
            syncGuidance = `${failed} failed action${failed === 1 ? '' : 's'} and ${unresolved} unresolved outcome${unresolved === 1 ? '' : 's'} need attention.`;
        } else if (unresolved > 0) {
            syncGuidance = `${unresolved} unresolved outcome${unresolved === 1 ? '' : 's'} need reconciliation before changing or discarding evidence.`;
        } else {
            syncGuidance = `${failed} saved action${failed === 1 ? '' : 's'} failed. Tap to review and retry.`;
        }
    } else if (submittingUserActions > 0) {
        syncGuidance = 'Saved actions are uploading to dispatch server now.';
    } else if (waitingUserActions > 0) {
        if (isOnline === false) {
            syncGuidance = `${waitingUserActions} action${waitingUserActions === 1 ? '' : 's'} saved on this device. Reconnect to sync.`;
        } else {
            syncGuidance = `${waitingUserActions} action${waitingUserActions === 1 ? '' : 's'} waiting to sync.`;
        }
    } else if (isOnline === false) {
        syncGuidance = 'Offline — actions are saved safely on this device.';
    }

    const canSyncNow =
        isOnline === true &&
        isAuthenticated &&
        !isProcessing &&
        (waitingUserActions > 0 || attentionItems.some((i) => i.retryable));

    return {
        isOnline,
        isAuthenticated,
        isProcessing,
        lastSuccessfulSyncAt: lastSuccessfulSyncAt ?? null,
        headerPill: {
            label: pillLabel,
            message: pillMessage,
            tone: pillTone,
            accessibilityLabel,
        },
        counts: {
            total: commands.length,
            waiting: waitingUserActions,
            submitting: submittingUserActions,
            attention: attentionCount,
            completed: completedCount,
            telemetry: telemetryCount,
            totalActive,
        },
        sections: {
            attention: attentionItems,
            active: activeItems,
            telemetry: telemetrySummary,
            recentCompleted: boundedCompleted,
        },
        canSyncNow,
        syncGuidance,
    };
}
