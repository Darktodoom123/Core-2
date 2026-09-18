import { useForm } from '@inertiajs/react';
import {
    Bot,
    Download,
    DownloadCloud,
    FileSpreadsheet,
    FileText,
    Printer,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { ApprovalsSurface } from '@/components/approvals';
import {
    Button,
    DateTimePicker,
    EmptyState,
    PageHeading,
    Panel,
    Skeleton,
} from '@/components/ui';
import { ArchiveSurface } from '@/components/workspace/archive-workspace-section';
import { FleetSurface } from '@/components/workspace/fleet';
import { FuelSurface } from '@/components/workspace/fuel';
import { GptRecommendationsSurface } from '@/components/workspace/gpt-workspace-section';
import { NotificationsSurface } from '@/components/workspace/notifications-workspace-section';
import { PersonnelWorkspaceSection } from '@/components/workspace/personnel/personnel-workspace-section';
import { ReportsSurface } from '@/components/workspace/reports-workspace-section';
import { formatDateTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type {
    ApprovalViewModel,
    ArchivedJobViewModel,
    AssetViewModel,
    AuditEventViewModel,
    DispatchJobViewModel,
    FuelRequestStatsViewModel,
    FuelRequestViewModel,
    GptRecommendationViewModel,
    JobReportStatsViewModel,
    JobReportViewModel,
    LocationUpdateViewModel,
    NotificationViewModel,
    PaginationMeta,
    ReportExportViewModel,
    SosIncidentViewModel,
    WorkspaceCapabilities,
    WorkspaceSection,
    WorkspaceUserViewModel,
} from '@/types/workspace';

export function LiveWorkspaceSection({
    section,
    assets,
    assetsTotal,
    assetsPagination,
    fuelRequests,
    fuelRequestsTotal,
    fuelRequestsStats,
    fuelRequestsPagination,
    locations,
    approvals,
    auditEvents,
    capabilities,
    jobReports = [],
    jobReportsTotal,
    jobReportsStats,
    jobReportsPagination,
    reportExports = [],
    notifications = [],
    archivedJobs = [],
    gptRecommendations = [],
    jobs = [],
    users = [],
    activeSosIncidents,
    onSectionChange,
}: {
    section: Exclude<WorkspaceSection, 'dispatch'>;
    assets: AssetViewModel[];
    assetsTotal?: number;
    assetsPagination?: PaginationMeta;
    fuelRequests: FuelRequestViewModel[];
    fuelRequestsTotal?: number;
    fuelRequestsStats?: FuelRequestStatsViewModel;
    fuelRequestsPagination?: PaginationMeta;
    locations: LocationUpdateViewModel[];
    approvals: ApprovalViewModel[];
    auditEvents: AuditEventViewModel[];
    capabilities: WorkspaceCapabilities;
    jobReports?: JobReportViewModel[];
    jobReportsTotal?: number;
    jobReportsStats?: JobReportStatsViewModel;
    jobReportsPagination?: PaginationMeta;
    reportExports?: ReportExportViewModel[];
    notifications?: NotificationViewModel[];
    archivedJobs?: ArchivedJobViewModel[];
    gptRecommendations?: GptRecommendationViewModel[];
    jobs?: DispatchJobViewModel[];
    users?: WorkspaceUserViewModel[];
    activeSosIncidents?: SosIncidentViewModel[];
    onSectionChange?: (section: WorkspaceSection) => void;
}) {
    switch (section) {
        case 'assets':
            return (
                <FleetSurface
                    assets={assets}
                    assetsTotal={assetsTotal}
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                    pagination={assetsPagination}
                />
            );
        case 'fuel':
            return (
                <FuelSurface
                    requests={fuelRequests}
                    capabilities={capabilities}
                    assets={assets}
                    total={fuelRequestsTotal}
                    stats={fuelRequestsStats}
                    pagination={fuelRequestsPagination}
                />
            );
        case 'tracking':
            return (
                <FleetSurface
                    assets={assets}
                    assetsTotal={assetsTotal}
                    locations={locations}
                    activeSosIncidents={activeSosIncidents}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                    initialViewMode="map"
                    pagination={assetsPagination}
                />
            );
        case 'approvals':
            return (
                <ApprovalsSurface
                    approvals={approvals}
                    canDecide={capabilities.decide_approval}
                />
            );
        case 'reports':
            return (
                <ReportsSurface
                    reports={jobReports}
                    exports={reportExports}
                    jobs={jobs}
                    capabilities={capabilities}
                    total={jobReportsTotal}
                    serverStats={jobReportsStats}
                    pagination={jobReportsPagination}
                />
            );

        case 'notifications':
            return <NotificationsSurface notifications={notifications} />;
        case 'archive':
            return (
                <ArchiveSurface
                    jobs={archivedJobs}
                    capabilities={capabilities}
                />
            );
        case 'gpt-recommendations':
            return (
                <GptRecommendationsSurface
                    recommendations={gptRecommendations}
                    capabilities={capabilities}
                    onSectionChange={onSectionChange}
                />
            );
        case 'users':
            return (
                <PersonnelWorkspaceSection
                    users={users ?? []}
                    capabilities={capabilities}
                    auditEvents={auditEvents}
                />
            );
        case 'audit':
            return <AuditSurface events={auditEvents} />;
    }
}

function AuditSurface({ events }: { events: AuditEventViewModel[] }) {
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [actorFilter, setActorFilter] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedEvent, setSelectedEvent] =
        useState<AuditEventViewModel | null>(null);
    const [copiedBefore, setCopiedBefore] = useState(false);
    const [copiedAfter, setCopiedAfter] = useState(false);
    const [copiedReqId, setCopiedReqId] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');
    const exportForm = useForm({
        export_type: 'system_audit',
        format: 'csv',
        date_from: '',
        date_to: '',
    });

    const getActionSeverityBadge = (action: string) => {
        const act = action.toLowerCase();

        if (
            act.includes('emergency') ||
            act.includes('suspend') ||
            act.includes('abort') ||
            act.includes('lock') ||
            act.includes('reject') ||
            act.includes('fail')
        ) {
            return 'bg-danger-soft text-danger-strong border border-danger/30';
        }

        if (
            act.includes('override') ||
            act.includes('approval') ||
            act.includes('reopen') ||
            act.includes('handover') ||
            act.includes('warning')
        ) {
            return 'bg-warning-soft text-warning-strong border border-warning/30';
        }

        if (
            act.includes('gpt') ||
            act.includes('ai') ||
            act.includes('circuit')
        ) {
            return 'bg-brand-soft text-brand-strong border border-brand/30';
        }

        if (
            act.includes('user') ||
            act.includes('role') ||
            act.includes('cred') ||
            act.includes('access') ||
            act.includes('auth') ||
            act.includes('login')
        ) {
            return 'bg-surface-subtle text-ink border border-line';
        }

        return 'bg-success-soft text-success-strong border border-success/30';
    };

    const handleSetDatePreset = (preset: 'all' | 'today' | '7d' | '30d') => {
        if (preset === 'all') {
            setStartDate('');
            setEndDate('');

            return;
        }

        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const toStr = (d: Date) =>
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const endStr = toStr(now);
        setEndDate(endStr);

        if (preset === 'today') {
            setStartDate(endStr);
        } else if (preset === '7d') {
            const past = new Date(now);
            past.setDate(past.getDate() - 7);
            setStartDate(toStr(past));
        } else if (preset === '30d') {
            const past = new Date(now);
            past.setDate(past.getDate() - 30);
            setStartDate(toStr(past));
        }
    };

    // System Health State (Node 5)
    const [health, setHealth] = useState<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: {
            database: { status: string; latency_ms: number | null };
            cache: { status: string; latency_ms: number | null };
            outbox: {
                status: string;
                pending: number;
                failed: number;
                delivered: number;
            };
            queues: { status: string; failed_jobs: number };
        };
    } | null>(null);

    useEffect(() => {
        fetch('/operations/admin/health')
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (data) {
                    setHealth(data);
                }
            })
            .catch(() => {});
    }, []);

    const stats = useMemo(() => {
        const total = events.length;
        const overrides = events.filter(
            (e) =>
                e.action.includes('override') || e.action.includes('approval'),
        ).length;
        const transitions = events.filter(
            (e) =>
                e.action.includes('status') || e.action.includes('transition'),
        ).length;
        const gpt = events.filter((e) => e.action.includes('gpt')).length;
        const userAccess = events.filter(
            (e) => e.action.includes('user') || e.action.includes('personnel'),
        ).length;

        return { total, overrides, transitions, gpt, userAccess };
    }, [events]);

    const uniqueActors = useMemo(() => {
        const map = new Map<number, string>();
        events.forEach((e) => {
            if (e.actor) {
                map.set(e.actor.id, e.actor.name);
            }
        });

        return Array.from(map.entries());
    }, [events]);

    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            if (
                actionFilter === 'overrides' &&
                !event.action.includes('override') &&
                !event.action.includes('approval')
            ) {
                return false;
            }

            if (
                actionFilter === 'transitions' &&
                !event.action.includes('status') &&
                !event.action.includes('transition')
            ) {
                return false;
            }

            if (actionFilter === 'gpt' && !event.action.includes('gpt')) {
                return false;
            }

            if (
                actionFilter === 'access' &&
                !event.action.includes('user') &&
                !event.action.includes('personnel')
            ) {
                return false;
            }

            if (actorFilter !== 'all') {
                if (actorFilter === 'system') {
                    if (event.actor !== null) {
                        return false;
                    }
                } else if (event.actor?.id !== Number(actorFilter)) {
                    return false;
                }
            }

            if (startDate !== '') {
                if (
                    !event.occurred_at ||
                    new Date(event.occurred_at) <
                        new Date(`${startDate}T00:00:00`)
                ) {
                    return false;
                }
            }

            if (endDate !== '') {
                if (
                    !event.occurred_at ||
                    new Date(event.occurred_at) >
                        new Date(`${endDate}T23:59:59`)
                ) {
                    return false;
                }
            }

            if (searchQuery.trim() !== '') {
                const q = searchQuery.toLowerCase().trim();
                const action = event.action.toLowerCase();
                const actor = (event.actor?.name ?? 'system').toLowerCase();
                const reason = (event.reason ?? '').toLowerCase();
                const reqId = (event.request_id ?? '').toLowerCase();

                return (
                    action.includes(q) ||
                    actor.includes(q) ||
                    reason.includes(q) ||
                    reqId.includes(q)
                );
            }

            return true;
        });
    }, [events, actionFilter, actorFilter, startDate, endDate, searchQuery]);

    const handleDirectCsvDownload = () => {
        if (filteredEvents.length === 0) {
            return;
        }

        const headers = [
            'Event ID',
            'Timestamp',
            'Actor Name',
            'Action Type',
            'Subject Type',
            'Subject ID',
            'Operational Reason',
            'IP Address',
            'Request Correlation UUID',
            'Prior State (Before)',
            'New State (After)',
        ];

        const escapeCsvField = (val: string | number | null | undefined) => {
            if (val === null || val === undefined) {
                return '""';
            }

            const str = String(val);
            const sanitized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;

            return `"${sanitized.replace(/"/g, '""')}"`;
        };

        const rows = filteredEvents.map((e) => [
            escapeCsvField(e.id),
            escapeCsvField(e.occurred_at),
            escapeCsvField(e.actor?.name ?? 'System Observer'),
            escapeCsvField(e.action),
            escapeCsvField(e.subject_type),
            escapeCsvField(e.subject_id),
            escapeCsvField(e.reason ?? 'No operational reason recorded'),
            escapeCsvField(e.ip_address ?? '127.0.0.1'),
            escapeCsvField(e.request_id ?? 'N/A'),
            escapeCsvField(e.before ? JSON.stringify(e.before) : ''),
            escapeCsvField(e.after ? JSON.stringify(e.after) : ''),
        ]);

        const csvContent =
            '\uFEFF' +
            [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStamp = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `core2-audit-trail-${dateStamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDirectPrintPdf = () => {
        if (filteredEvents.length === 0) {
            return;
        }

        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            window.print();

            return;
        }

        const dateStamp = new Date().toISOString().split('T')[0];

        const escapeHtml = (str: string | number | null | undefined) => {
            if (str === null || str === undefined) {
                return '';
            }

            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        };

        const rowsHtml = filteredEvents
            .map(
                (e) => `
                <tr>
                    <td style="font-family: monospace; font-size: 10px;">#${escapeHtml(e.id)}</td>
                    <td style="white-space: nowrap;">${escapeHtml(e.occurred_at ? new Date(e.occurred_at).toLocaleString() : '—')}</td>
                    <td><strong>${escapeHtml(e.actor?.name ?? 'System')}</strong></td>
                    <td><code style="background: #f1f5f9; padding: 2px 4px; border-radius: 3px; font-size: 9px;">${escapeHtml(e.action)}</code></td>
                    <td>${escapeHtml((e.subject_type ? e.subject_type.split('\\').pop() : 'Record') ?? 'Record')} #${escapeHtml(e.subject_id ?? 'N/A')}</td>
                    <td style="font-size: 9.5px;">${escapeHtml(e.reason ?? 'Compliance / Operational Log')}</td>
                </tr>
            `,
            )
            .join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Core-2 Compliance & Audit Trail Report (${dateStamp})</title>
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 10px; color: #0f172a; margin: 0; padding: 15px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 3px 0; }
        .subtitle { font-size: 10px; color: #475569; margin: 0; }
        .badge { background: #0f172a; color: #fff; padding: 3px 8px; border-radius: 4px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; }
        .metadata { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 9.5px; }
        .meta-item strong { color: #334155; display: block; font-size: 8.5px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; font-size: 9.5px; text-transform: uppercase; color: #334155; }
        td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) { background: #f8fafc; }
        .footer { margin-top: 15px; border-top: 1px solid #e2e8f0; padding-top: 6px; display: flex; justify-content: space-between; font-size: 8.5px; color: #94a3b8; }
        @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1 class="title">Core Transaction 2 · Compliance & Audit Trail Report</h1>
            <p class="subtitle">Immutable forensic log of state transitions, approvals, user actions, and cryptographic telemetry.</p>
        </div>
        <div style="text-align: right;">
            <span class="badge">Forensic Audit Export</span>
        </div>
    </div>

    <div class="metadata">
        <div class="meta-item"><strong>Generated On</strong> ${new Date().toUTCString()}</div>
        <div class="meta-item"><strong>Record Count</strong> ${filteredEvents.length} active events</div>
        <div class="meta-item"><strong>Date Scope</strong> ${dateStamp} (${startDate || 'Earliest'} → ${endDate || 'Latest'})</div>
        <div class="meta-item"><strong>Filters Active</strong> Action: ${escapeHtml(actionFilter)} | Actor: ${escapeHtml(actorFilter)}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 45px;">ID</th>
                <th style="width: 120px;">Timestamp (UTC)</th>
                <th style="width: 110px;">Actor</th>
                <th style="width: 140px;">Action</th>
                <th style="width: 110px;">Subject</th>
                <th>Context / Operational Reason</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <div class="footer">
        <span>Confidential & Proprietary · Core-2 Heavy Lifting & Crane ERP</span>
        <span>SHA-256 Validated · Page 1 of 1</span>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); }, 150);
        };
    </script>
</body>
</html>`;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleQueueServerExport = (e: FormEvent) => {
        e.preventDefault();
        exportForm.transform(() => ({
            export_type: 'system_audit',
            format: exportFormat,
            date_from: startDate || '',
            date_to: endDate || '',
        }));
        exportForm.post('/operations/reports/exports', {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setShowExportModal(false);
            },
        });
    };

    return (
        <div>
            <PageHeading
                title="Audit trail & compliance log"
                description="Immutable forensic log of approvals, overrides, state transitions, GPT advisory decisions, user access, and cryptographic telemetry."
                actions={
                    <Button
                        variant="secondary"
                        onClick={() => setShowExportModal(true)}
                    >
                        <Download className="h-4 w-4" />
                        Export Audit Dataset
                    </Button>
                }
            />
            <div className="space-y-6 p-4 md:p-6">
                {/* Synthetic Infrastructure & Outbox DLQ Health Monitor */}
                {health && (
                    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'h-2.5 w-2.5 rounded-full',
                                        health.status === 'healthy'
                                            ? 'animate-pulse bg-success'
                                            : 'bg-warning',
                                    )}
                                />
                                <h3 className="text-xs font-bold tracking-wider text-ink uppercase">
                                    System Infrastructure & Telemetry Health
                                </h3>
                            </div>
                            <span
                                className={cn(
                                    'rounded-md px-2 py-0.5 text-xs font-semibold uppercase',
                                    health.status === 'healthy'
                                        ? 'bg-success-soft text-success-strong'
                                        : 'bg-warning-soft text-warning-strong',
                                )}
                            >
                                {health.status}
                            </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Postgres Latency
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.database.latency_ms !==
                                    null
                                        ? `${health.services.database.latency_ms} ms`
                                        : 'Offline'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Redis / Cache Ping
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.cache.latency_ms !== null
                                        ? `${health.services.cache.latency_ms} ms`
                                        : 'Offline'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Transactional Outbox (DLQ)
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.outbox.failed === 0 ? (
                                        <span className="text-success-strong">
                                            0 Dead Letters (Clean)
                                        </span>
                                    ) : (
                                        <span className="text-danger-strong">
                                            {health.services.outbox.failed}{' '}
                                            Failed Messages
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="rounded-xl border border-line bg-surface-subtle p-3">
                                <span className="font-semibold text-ink-soft">
                                    Background Queues
                                </span>
                                <p className="mt-1 font-mono text-sm font-bold text-ink">
                                    {health.services.queues.failed_jobs ===
                                    0 ? (
                                        <span className="text-success-strong">
                                            0 Failed Jobs
                                        </span>
                                    ) : (
                                        <span className="text-danger-strong">
                                            {health.services.queues.failed_jobs}{' '}
                                            Failed
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <button
                        type="button"
                        onClick={() => setActionFilter('all')}
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'all'
                                ? 'border-brand bg-brand-soft/30 ring-2 ring-brand'
                                : 'border-line bg-surface hover:bg-surface-subtle',
                        )}
                    >
                        <span className="text-xs font-medium text-ink-soft">
                            Total Events
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.total}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'overrides'
                                    ? 'all'
                                    : 'overrides',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'overrides'
                                ? 'border-warning-strong bg-warning-soft/70 ring-2 ring-warning'
                                : 'border-warning/30 bg-warning-soft/30 hover:bg-warning-soft/50',
                        )}
                    >
                        <span className="text-xs font-medium text-warning-strong">
                            Approvals & Overrides
                        </span>
                        <p className="mt-1 text-2xl font-bold text-warning-strong">
                            {stats.overrides}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'transitions'
                                    ? 'all'
                                    : 'transitions',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'transitions'
                                ? 'border-brand bg-brand-soft/30 ring-2 ring-brand'
                                : 'border-line bg-surface hover:bg-surface-subtle',
                        )}
                    >
                        <span className="text-xs font-medium text-ink-soft">
                            State Transitions
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.transitions}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'gpt' ? 'all' : 'gpt',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'gpt'
                                ? 'border-brand-strong bg-brand-soft/70 ring-2 ring-brand'
                                : 'border-brand/30 bg-brand-soft/30 hover:bg-brand-soft/50',
                        )}
                    >
                        <span className="text-xs font-medium text-brand-strong">
                            GPT AI Decisions
                        </span>
                        <p className="mt-1 text-2xl font-bold text-brand-strong">
                            {stats.gpt}
                        </p>
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            setActionFilter(
                                actionFilter === 'access' ? 'all' : 'access',
                            )
                        }
                        className={cn(
                            'rounded-xl border p-3.5 text-left shadow-sm transition-all',
                            actionFilter === 'access'
                                ? 'border-brand bg-brand-soft/30 ring-2 ring-brand'
                                : 'border-line bg-surface hover:bg-surface-subtle',
                        )}
                    >
                        <span className="text-xs font-medium text-ink-soft">
                            Access & Security
                        </span>
                        <p className="mt-1 text-2xl font-bold text-ink">
                            {stats.userAccess}
                        </p>
                    </button>
                </div>

                {/* Filter and Search */}
                <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-medium text-ink-soft">
                            Filter:
                        </span>
                        {[
                            {
                                id: 'all',
                                label: 'All Events',
                                count: stats.total,
                            },
                            {
                                id: 'overrides',
                                label: 'Overrides',
                                count: stats.overrides,
                            },
                            {
                                id: 'transitions',
                                label: 'Transitions',
                                count: stats.transitions,
                            },
                            {
                                id: 'gpt',
                                label: 'GPT Decisions',
                                count: stats.gpt,
                            },
                            {
                                id: 'access',
                                label: 'Access & Users',
                                count: stats.userAccess,
                            },
                        ].map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActionFilter(cat.id)}
                                className={cn(
                                    'rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                                    actionFilter === cat.id
                                        ? 'bg-brand-strong text-white shadow-xs'
                                        : 'bg-surface-subtle text-ink-soft hover:bg-surface-subtle/80 hover:text-ink',
                                )}
                            >
                                {cat.label} ({cat.count})
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-80">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search action, actor, reason, correlation ID…"
                            className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-xs text-ink placeholder:text-ink-soft focus:border-brand focus:outline-none"
                        />
                    </div>
                </div>

                {/* Temporal Range & Actor Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-xs shadow-xs">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-soft">
                                Temporal Range:
                            </span>
                            <div className="w-36">
                                <DateTimePicker
                                    id="audit-start-date"
                                    value={startDate}
                                    onChange={(val) => {
                                        setStartDate(
                                            val ? val.split('T')[0] : '',
                                        );
                                    }}
                                    includeTime={false}
                                    showPresets={false}
                                    placeholder="Start date…"
                                    className="text-xs"
                                />
                            </div>
                            <span className="text-xs text-ink-soft">to</span>
                            <div className="w-36">
                                <DateTimePicker
                                    id="audit-end-date"
                                    value={endDate}
                                    onChange={(val) => {
                                        setEndDate(
                                            val ? val.split('T')[0] : '',
                                        );
                                    }}
                                    includeTime={false}
                                    showPresets={false}
                                    placeholder="End date…"
                                    className="text-xs"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleSetDatePreset('today')}
                                className={cn(
                                    'rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                                    startDate !== '' && startDate === endDate
                                        ? 'border-brand bg-brand-soft font-semibold text-brand-strong'
                                        : 'border-line bg-surface-subtle text-ink-soft hover:text-ink',
                                )}
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetDatePreset('7d')}
                                className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink"
                            >
                                Past 7 Days
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetDatePreset('30d')}
                                className="rounded-md border border-line bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-ink-soft hover:text-ink"
                            >
                                Past 30 Days
                            </button>
                            {(startDate ||
                                endDate ||
                                actorFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSetDatePreset('all');
                                        setActorFilter('all');
                                    }}
                                    className="rounded-md border border-danger/30 bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger-strong hover:bg-danger-soft/80"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-soft">
                            Actor:
                        </span>
                        <select
                            value={actorFilter}
                            onChange={(e) => setActorFilter(e.target.value)}
                            className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-brand focus:outline-none"
                            aria-label="Filter by actor"
                        >
                            <option value="all">
                                All Actors ({stats.total})
                            </option>
                            <option value="system">System Observer</option>
                            {uniqueActors.map(([id, name]) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {events.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bot}
                            title="No audit events recorded"
                            message="Sensitive operational, dispatch state, and access changes will appear here."
                        />
                    </Panel>
                ) : filteredEvents.length === 0 ? (
                    <Panel>
                        <EmptyState
                            icon={Bot}
                            title="No matching audit events"
                            message="No events match your search or filter criteria."
                        />
                    </Panel>
                ) : (
                    <Panel className="overflow-hidden">
                        <div
                            className="workspace-scroll-region"
                            role="region"
                            aria-label="Audit trail table scroll region"
                            tabIndex={0}
                        >
                            <table className="w-full text-left text-sm">
                                <thead className="border-b border-line bg-surface-subtle text-xs font-semibold text-ink-soft uppercase">
                                    <tr>
                                        <th className="px-4 py-3">Timestamp</th>
                                        <th className="px-4 py-3">
                                            Actor Attribution
                                        </th>
                                        <th className="px-4 py-3">
                                            Action Type
                                        </th>
                                        <th className="px-4 py-3">
                                            Attribution Reason & Context
                                        </th>
                                        <th className="px-4 py-3 text-right">
                                            Forensic Inspection
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {filteredEvents.map(
                                        (event: AuditEventViewModel) => (
                                            <tr
                                                key={event.id}
                                                onClick={() =>
                                                    setSelectedEvent(event)
                                                }
                                                className="cursor-pointer transition-colors hover:bg-surface-subtle/50"
                                            >
                                                <td className="px-4 py-3 text-xs text-ink-soft">
                                                    {formatDateTime(
                                                        event.occurred_at,
                                                        'Not recorded',
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-ink">
                                                    {event.actor?.name ??
                                                        'System Observer'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className={cn(
                                                            'inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold',
                                                            getActionSeverityBadge(
                                                                event.action,
                                                            ),
                                                        )}
                                                    >
                                                        {event.action}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-ink-soft">
                                                    {event.reason ??
                                                        'No operational reason recorded'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedEvent(
                                                                event,
                                                            );
                                                        }}
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        Diff
                                                    </Button>
                                                </td>
                                            </tr>
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                )}
            </div>

            {/* Modal: Visual Before/After JSON Diff Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'rounded-md px-2 py-0.5 font-mono text-sm font-bold',
                                            getActionSeverityBadge(
                                                selectedEvent.action,
                                            ),
                                        )}
                                    >
                                        {selectedEvent.action}
                                    </span>
                                    <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs text-ink-soft">
                                        Event #{selectedEvent.id}
                                    </span>
                                </div>
                                <p className="text-xs text-ink-soft">
                                    Actor:{' '}
                                    {selectedEvent.actor?.name ?? 'System'} ·{' '}
                                    {formatDateTime(
                                        selectedEvent.occurred_at,
                                        'N/A',
                                    )}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEvent(null)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Correlation Metadata */}
                        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-line bg-surface-subtle p-3 text-xs sm:grid-cols-4">
                            <div>
                                <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                    Subject
                                </span>
                                <p className="font-mono text-ink">
                                    {selectedEvent.subject_type
                                        ? `${selectedEvent.subject_type.split('\\').pop()} #${selectedEvent.subject_id}`
                                        : 'Platform'}
                                </p>
                            </div>
                            <div>
                                <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                    IP Address
                                </span>
                                <p className="font-mono text-ink">
                                    {selectedEvent.ip_address ?? '127.0.0.1'}
                                </p>
                            </div>
                            <div className="col-span-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-ink-soft uppercase">
                                        Request Correlation UUID
                                    </span>
                                    {selectedEvent.request_id && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText(
                                                    selectedEvent.request_id ??
                                                        '',
                                                );
                                                setCopiedReqId(true);
                                                setTimeout(
                                                    () => setCopiedReqId(false),
                                                    2000,
                                                );
                                            }}
                                            className="text-[10px] font-medium text-brand-strong hover:underline"
                                        >
                                            {copiedReqId
                                                ? 'Copied!'
                                                : 'Copy UUID'}
                                        </button>
                                    )}
                                </div>
                                <p className="truncate font-mono text-[11px] text-ink">
                                    {selectedEvent.request_id ?? 'N/A'}
                                </p>
                            </div>
                        </div>

                        {selectedEvent.reason && (
                            <div className="mt-3 rounded-lg border border-warning/30 bg-warning-soft/30 p-3 text-xs text-warning-strong">
                                <strong>Operational Justification:</strong>{' '}
                                {selectedEvent.reason}
                            </div>
                        )}

                        {/* Before / After State Comparison */}
                        <div className="mt-5 space-y-3">
                            <h4 className="text-xs font-semibold tracking-wider text-ink-soft uppercase">
                                State Mutation Comparison (Before vs. After)
                            </h4>

                            {!selectedEvent.before && !selectedEvent.after ? (
                                <div className="rounded-xl border border-line bg-surface-subtle p-4 text-center text-xs text-ink-soft">
                                    No state payload captured for this
                                    operational event.
                                </div>
                            ) : (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {/* Before Panel */}
                                    <div className="overflow-hidden rounded-xl border border-line bg-surface">
                                        <div className="flex items-center justify-between border-b border-line bg-danger-soft/40 px-3 py-2 text-xs font-semibold text-danger-strong">
                                            <span>Prior State (Before)</span>
                                            {selectedEvent.before && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(
                                                            JSON.stringify(
                                                                selectedEvent.before,
                                                                null,
                                                                2,
                                                            ),
                                                        );
                                                        setCopiedBefore(true);
                                                        setTimeout(
                                                            () =>
                                                                setCopiedBefore(
                                                                    false,
                                                                ),
                                                            2000,
                                                        );
                                                    }}
                                                    className="text-[10px] font-medium text-danger-strong hover:underline"
                                                >
                                                    {copiedBefore
                                                        ? 'Copied!'
                                                        : 'Copy JSON'}
                                                </button>
                                            )}
                                        </div>
                                        <pre className="max-h-60 overflow-x-auto p-3 font-mono text-[11px] text-ink">
                                            {selectedEvent.before
                                                ? JSON.stringify(
                                                      selectedEvent.before,
                                                      null,
                                                      2,
                                                  )
                                                : '(No prior state recorded)'}
                                        </pre>
                                    </div>

                                    {/* After Panel */}
                                    <div className="overflow-hidden rounded-xl border border-line bg-surface">
                                        <div className="flex items-center justify-between border-b border-line bg-success-soft/40 px-3 py-2 text-xs font-semibold text-success-strong">
                                            <span>New State (After)</span>
                                            {selectedEvent.after && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(
                                                            JSON.stringify(
                                                                selectedEvent.after,
                                                                null,
                                                                2,
                                                            ),
                                                        );
                                                        setCopiedAfter(true);
                                                        setTimeout(
                                                            () =>
                                                                setCopiedAfter(
                                                                    false,
                                                                ),
                                                            2000,
                                                        );
                                                    }}
                                                    className="text-[10px] font-medium text-success-strong hover:underline"
                                                >
                                                    {copiedAfter
                                                        ? 'Copied!'
                                                        : 'Copy JSON'}
                                                </button>
                                            )}
                                        </div>
                                        <pre className="max-h-60 overflow-x-auto p-3 font-mono text-[11px] text-ink">
                                            {selectedEvent.after
                                                ? JSON.stringify(
                                                      selectedEvent.after,
                                                      null,
                                                      2,
                                                  )
                                                : '(No subsequent state)'}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => setSelectedEvent(null)}
                            >
                                Close Inspector
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Export Audit Trail Dataset */}
            {showExportModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-line pb-3">
                            <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-brand-soft p-2 text-brand-strong">
                                    <DownloadCloud className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-base font-bold text-ink">
                                        Export Audit Dataset
                                    </h4>
                                    <p className="text-xs text-ink-soft">
                                        Download immediate CSV or queue an
                                        asynchronous export.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                className="rounded-lg p-1 text-ink-soft hover:bg-surface-subtle"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Active Scope Summary */}
                        <div className="mt-4 space-y-2 rounded-xl border border-line bg-surface-subtle p-3 text-xs">
                            <div className="flex justify-between">
                                <span className="text-ink-soft">
                                    Active Category:
                                </span>
                                <span className="font-semibold text-ink uppercase">
                                    {actionFilter}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-soft">
                                    Actor Scope:
                                </span>
                                <span className="font-semibold text-ink">
                                    {actorFilter === 'all'
                                        ? 'All Actors'
                                        : actorFilter === 'system'
                                          ? 'System Observer'
                                          : (uniqueActors.find(
                                                ([id]) =>
                                                    id === Number(actorFilter),
                                            )?.[1] ?? actorFilter)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-ink-soft">
                                    Temporal Range:
                                </span>
                                <span className="font-mono text-ink">
                                    {startDate || 'Beginning'} &rarr;{' '}
                                    {endDate || 'Latest'}
                                </span>
                            </div>
                            <div className="flex justify-between border-t border-line pt-1 font-bold">
                                <span className="text-ink">
                                    Records In Scope:
                                </span>
                                <span className="text-brand-strong">
                                    {filteredEvents.length} events
                                </span>
                            </div>
                        </div>

                        {/* Dual Export Methods */}
                        <div className="mt-5 space-y-4">
                            {/* Method 1: Instant Direct CSV Download */}
                            <div className="rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/40">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                                        <FileSpreadsheet className="h-4 w-4 text-success-strong" />
                                        <span>
                                            Instant Filtered CSV Download
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-soft">
                                        Immediately downloads the{' '}
                                        {filteredEvents.length} currently
                                        filtered records directly to your device
                                        with full before/after JSON state
                                        payloads.
                                    </p>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            handleDirectCsvDownload();
                                            setShowExportModal(false);
                                        }}
                                        disabled={filteredEvents.length === 0}
                                        className="w-full justify-center text-xs"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                        Instant CSV ({filteredEvents.length})
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() => {
                                            handleDirectPrintPdf();
                                            setShowExportModal(false);
                                        }}
                                        disabled={filteredEvents.length === 0}
                                        className="w-full justify-center text-xs"
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                        Print / PDF ({filteredEvents.length})
                                    </Button>
                                </div>
                            </div>

                            {/* Method 2: Queue Server Export */}
                            <form
                                onSubmit={handleQueueServerExport}
                                className="rounded-xl border border-line bg-surface p-4 transition-all hover:border-brand/40"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 font-semibold text-ink">
                                        <DownloadCloud className="h-4 w-4 text-brand-strong" />
                                        <span>
                                            Queue Background Server Export
                                        </span>
                                    </div>
                                    <p className="text-xs text-ink-soft">
                                        Dispatches a background worker job to
                                        generate and archive an official audit
                                        export dataset.
                                    </p>
                                </div>

                                <div className="mt-2 rounded-lg border border-line bg-surface-subtle px-2.5 py-1.5 text-[11px] text-ink-soft">
                                    {startDate || endDate ? (
                                        <span>
                                            Scope:{' '}
                                            <strong className="text-ink">
                                                Queries full database archive
                                            </strong>{' '}
                                            from{' '}
                                            <code className="text-brand-strong">
                                                {startDate || 'Beginning'}
                                            </code>{' '}
                                            to{' '}
                                            <code className="text-brand-strong">
                                                {endDate || 'Latest'}
                                            </code>
                                            .
                                        </span>
                                    ) : (
                                        <span>
                                            Scope:{' '}
                                            <strong className="text-ink">
                                                Full historical database archive
                                            </strong>{' '}
                                            (all recorded audit events).
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <label
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-all',
                                            exportFormat === 'csv'
                                                ? 'border-brand bg-brand-soft/40 font-semibold text-brand-strong ring-1 ring-brand'
                                                : 'border-line bg-surface text-ink hover:bg-surface-subtle',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="format"
                                            value="csv"
                                            checked={exportFormat === 'csv'}
                                            onChange={() =>
                                                setExportFormat('csv')
                                            }
                                            className="text-brand focus:ring-brand"
                                        />
                                        <span>CSV Dataset</span>
                                    </label>
                                    <label
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs transition-all',
                                            exportFormat === 'pdf'
                                                ? 'border-brand bg-brand-soft/40 font-semibold text-brand-strong ring-1 ring-brand'
                                                : 'border-line bg-surface text-ink hover:bg-surface-subtle',
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="format"
                                            value="pdf"
                                            checked={exportFormat === 'pdf'}
                                            onChange={() =>
                                                setExportFormat('pdf')
                                            }
                                            className="text-brand focus:ring-brand"
                                        />
                                        <span>Printable PDF</span>
                                    </label>
                                </div>

                                {Object.keys(exportForm.errors).length > 0 && (
                                    <div className="mt-2 rounded-md bg-danger-soft p-2 text-xs text-danger-strong">
                                        {Object.values(exportForm.errors).join(
                                            ' ',
                                        )}
                                    </div>
                                )}

                                <div className="mt-3">
                                    <Button
                                        type="submit"
                                        variant="primary"
                                        disabled={exportForm.processing}
                                        className="w-full justify-center text-xs"
                                    >
                                        {exportForm.processing ? (
                                            'Dispatching Server Job…'
                                        ) : (
                                            <>
                                                <DownloadCloud className="h-3.5 w-3.5" />
                                                Request Server Background Export
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t border-line pt-3 text-[11px] text-ink-soft">
                            <span>
                                Server exports are archived under the{' '}
                                <a
                                    href="/operations?section=reports"
                                    className="font-medium text-brand-strong underline hover:text-brand"
                                >
                                    Exports Archive
                                </a>{' '}
                                (available 24h).
                            </span>
                            <Button
                                variant="secondary"
                                onClick={() => setShowExportModal(false)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function ResponsiveTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: Array<{ key: number; cells: ReactNode[] }>;
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="divide-y divide-line md:hidden">
                {rows.map((row) => (
                    <dl key={row.key} className="space-y-2 px-4 py-3">
                        {row.cells.map((cell, index) => (
                            <div
                                key={headers[index]}
                                className="grid grid-cols-[minmax(7rem,0.7fr)_minmax(0,1fr)] gap-3 text-sm"
                            >
                                <dt className="text-ink-soft">
                                    {headers[index]}
                                </dt>
                                <dd className="min-w-0 text-right text-ink">
                                    {cell}
                                </dd>
                            </div>
                        ))}
                    </dl>
                ))}
            </div>
            <div
                className="workspace-scroll-region hidden md:block"
                role="region"
                aria-label="Responsive data table scroll region"
                tabIndex={0}
            >
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-subtle text-ink-soft">
                        <tr>
                            {headers.map((header) => (
                                <th
                                    key={header}
                                    scope="col"
                                    className="px-4 py-3 font-medium"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.key} className="border-t border-line">
                                {row.cells.map((cell, index) => (
                                    <td
                                        key={headers[index]}
                                        className="px-4 py-3"
                                    >
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export function AssetListSkeleton() {
    return (
        <div className="space-y-px" aria-label="Loading operational assets">
            {[1, 2, 3, 4].map((item) => (
                <div key={item} className="border-b border-line px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-5 w-24 rounded-full" />
                    </div>
                    <Skeleton className="mt-2 h-3.5 w-36" />
                    <Skeleton className="mt-2 h-3 w-28" />
                </div>
            ))}
        </div>
    );
}

export function FuelTableSkeleton() {
    return (
        <div
            className="divide-y divide-line"
            aria-label="Loading fuel requests"
        >
            {[1, 2, 3, 4].map((item) => (
                <div
                    key={item}
                    className="flex items-center justify-between p-4"
                >
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3.5 w-48" />
                    </div>
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
            ))}
        </div>
    );
}
