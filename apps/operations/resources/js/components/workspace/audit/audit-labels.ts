import type { AuditCategory } from './audit-api';

/** Plain-language names for the actions people look for most often. */
const ACTION_LABELS: Record<string, string> = {
    'user.login': 'Signed in',
    'user.logout': 'Signed out',
    'user.created': 'Account created',
    'user.access_updated': 'Account access changed',
    'user.password_changed': 'Password changed',
    'user.password_reset': 'Password reset',
    'user.email_updated': 'Email changed',
    'user.profile_updated': 'Profile updated',
    'user.session_revoked': 'Session signed out',
    'user.other_sessions_revoked': 'Other sessions signed out',
    'user.trusted_device_revoked': 'Trusted device removed',
    'user.all_trusted_devices_revoked': 'All trusted devices removed',
    'user.lost_device_reported': 'Lost device reported',
    'user.email_otp_enabled': 'Two-step sign-in turned on',
    'user.email_otp_disabled': 'Two-step sign-in turned off',
    'personnel.credential_added': 'Credential added',
    'personnel.credential_updated': 'Credential updated',
    'personnel.credential_replaced': 'Credential replaced',
    'personnel.credential_removed': 'Credential removed',
    'personnel.profile_updated': 'Personnel profile updated',
    'dispatch.created': 'Dispatch created',
    'dispatch.activated': 'Dispatch activated',
    'dispatch.status_updated': 'Dispatch status changed',
    'dispatch.resources_assigned': 'Crew and equipment assigned',
    'dispatch.resource_requirements_updated': 'Resource needs changed',
    'dispatch.emergency_abort': 'Dispatch emergency abort',
    'asset.safety_lockdown': 'Unit safety lockdown',
    'asset.status_updated': 'Unit status changed',
    'asset.inspected': 'Unit inspected',
    'approval.decided': 'Approval decided',
    'gpt.recommendation_accepted': 'AI advice accepted',
    'gpt.recommendation_rejected': 'AI advice rejected',
    'gpt.recommendation_generated': 'AI advice generated',
    'gpt.recommendation_retried': 'AI advice retried',
    'gpt.circuit_breaker_paused': 'AI advice paused',
    'gpt.circuit_breaker_resumed': 'AI advice resumed',
    'safety.sos_triggered': 'SOS raised',
    'safety.sos_acknowledged': 'SOS acknowledged',
    'safety.sos_escalated': 'SOS escalated',
    'safety.sos_resolved': 'SOS resolved',
    'safety.sos_cancelled': 'SOS cancelled',
    'job_report.submitted': 'Job report submitted',
    'job_report.reviewed': 'Job report reviewed',
    'attachment.downloaded': 'File downloaded',
    'attachment.uploaded': 'File uploaded',
};

const DOMAIN_LABELS: Record<string, string> = {
    user: 'Account',
    personnel: 'Personnel',
    dispatch: 'Dispatch',
    dispatch_job: 'Dispatch',
    project_plan: 'Project plan',
    project_shift: 'Project shift',
    project_phase: 'Project phase',
    project_allocation: 'Project allocation',
    asset: 'Unit',
    maintenance: 'Maintenance',
    fuel: 'Fuel',
    safety: 'Safety',
    gpt: 'AI advice',
    job_report: 'Job report',
    attachment: 'File',
    rental_reservation: 'Rental',
    rental_operator: 'Rental operator',
    service_request: 'Service request',
    client: 'Client',
    approval: 'Approval',
};

function sentenceCase(value: string): string {
    const words = value.replace(/[_.]+/g, ' ').trim();

    return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "project_shift.coverage_confirmed" reads "Project shift · coverage confirmed". */
export function auditActionLabel(action: string): string {
    const known = ACTION_LABELS[action];

    if (known) {
        return known;
    }

    const [domain, ...rest] = action.split('.');
    const verb = rest.join(' ').replace(/_/g, ' ').trim();
    const domainLabel = DOMAIN_LABELS[domain] ?? sentenceCase(domain);

    return verb ? `${domainLabel} · ${verb}` : domainLabel;
}

const CATEGORY_PREFIXES: [AuditCategory, string[]][] = [
    ['access', ['user.', 'personnel.', 'account.', 'auth.']],
    [
        'dispatch',
        [
            'dispatch.',
            'dispatch_job',
            'project_',
            'service_request.',
            'client.',
            'rental_',
            'approval.',
        ],
    ],
    [
        'fleet',
        [
            'asset.',
            'maintenance.',
            'fuel.',
            'hos.',
            'dvir.',
            'equipment.',
            'unit_link.',
        ],
    ],
    ['safety', ['safety.']],
    ['reports', ['job_report.', 'report.', 'report_export', 'attachment.']],
    ['gpt', ['gpt.']],
];

const OVERRIDE_MARKERS = ['emergency_abort', 'safety_lockdown', 'override'];

export function isOverrideAction(action: string): boolean {
    return OVERRIDE_MARKERS.some((marker) => action.includes(marker));
}

/** Mirrors the server's AuditCategory prefixes for display only. */
export function auditCategoryOf(action: string): AuditCategory | null {
    for (const [category, prefixes] of CATEGORY_PREFIXES) {
        if (prefixes.some((prefix) => action.startsWith(prefix))) {
            return category;
        }
    }

    return null;
}

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
    access: 'Access & people',
    dispatch: 'Dispatch & planning',
    fleet: 'Fleet & fuel',
    safety: 'Safety & SOS',
    reports: 'Reports & files',
    gpt: 'AI advice',
    overrides: 'Admin overrides',
};

export type AuditTone = 'danger' | 'warning' | 'neutral';

/** Overrides and safety events stand out; everything else stays calm. */
export function auditTone(action: string): AuditTone {
    if (isOverrideAction(action) || action.startsWith('safety.sos_triggered')) {
        return 'danger';
    }

    if (
        action.startsWith('safety.') ||
        action.includes('revoked') ||
        action.includes('suspend') ||
        action.includes('lost_device') ||
        action.includes('circuit_breaker') ||
        action.includes('credential_removed')
    ) {
        return 'warning';
    }

    return 'neutral';
}

/** "App\\Modules\\Dispatch\\Models\\DispatchJob" or "dispatch_job" reads "Dispatch job". */
export function auditSubjectLabel(
    subjectType: string | null | undefined,
    subjectId: string | number | null | undefined,
): string | null {
    if (!subjectType) {
        return null;
    }

    const base = subjectType.split('\\').pop() ?? subjectType;
    const words = base
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .toLowerCase();
    const label = words.charAt(0).toUpperCase() + words.slice(1);

    return subjectId === null || subjectId === undefined
        ? label
        : `${label} #${subjectId}`;
}

export interface AuditChange {
    field: string;
    before: string;
    after: string;
}

function formatAuditValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
        return '—';
    }

    if (typeof value === 'object') {
        return JSON.stringify(value);
    }

    return String(value);
}

/** Fields whose value differs between the recorded before and after states. */
export function auditChanges(
    before: Record<string, unknown> | null | undefined,
    after: Record<string, unknown> | null | undefined,
): AuditChange[] {
    const fields = new Set([
        ...Object.keys(before ?? {}),
        ...Object.keys(after ?? {}),
    ]);

    return [...fields]
        .map((field) => ({
            field: field.replace(/_/g, ' '),
            before: formatAuditValue(before?.[field]),
            after: formatAuditValue(after?.[field]),
        }))
        .filter((change) => change.before !== change.after);
}
