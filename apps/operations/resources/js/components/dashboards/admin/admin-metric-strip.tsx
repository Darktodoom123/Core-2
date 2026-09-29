import { ArrowUpRight, Cpu, FileText, Sparkles, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui';
import type { AuditPage } from '@/components/workspace/audit/audit-api';
import { auditActionLabel } from '@/components/workspace/audit/audit-labels';
import { cn } from '@/lib/utils';
import { formatElapsed } from '../manager/manager-dashboard-model';
import type {
    AccountSummary,
    AiGovernance,
    SystemHealth,
} from './admin-dashboard-model';
import { budgetShare, formatUsd, healthCauses } from './admin-dashboard-model';

type ValueTone = 'default' | 'success' | 'warning' | 'danger';

const VALUE_TONES: Record<ValueTone, string> = {
    default: 'text-ink',
    success: 'text-success-strong',
    warning: 'text-warning-strong',
    danger: 'text-danger-strong',
};

export function AdminMetricStrip({
    health,
    healthError,
    accounts,
    ai,
    aiError,
    audit,
    auditError,
    now,
    canOpen,
    onOpen,
}: {
    health: SystemHealth | null;
    healthError: string | null;
    accounts: AccountSummary;
    ai: AiGovernance | null;
    aiError: string | null;
    audit: AuditPage | null;
    auditError: string | null;
    now: number;
    canOpen: (section: 'users' | 'gpt-recommendations' | 'audit') => boolean;
    onOpen: (section: 'users' | 'gpt-recommendations' | 'audit') => void;
}) {
    const causes = healthCauses(health);
    const share = budgetShare(ai);
    const latest = audit?.events[0] ?? null;

    return (
        <section
            aria-label="Platform at a glance"
            className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 xl:grid-cols-4"
        >
            <MetricCell label="Platform health" icon={Cpu}>
                {!health && !healthError ? (
                    <MetricLoading label="Running health checks" />
                ) : (
                    <>
                        <MetricValue
                            tone={
                                healthError || health?.status === 'unhealthy'
                                    ? 'danger'
                                    : health?.status === 'degraded'
                                      ? 'warning'
                                      : 'success'
                            }
                            value={
                                healthError
                                    ? 'Not reporting'
                                    : health?.status === 'healthy'
                                      ? 'Healthy'
                                      : health?.status === 'degraded'
                                        ? 'Degraded'
                                        : 'Unhealthy'
                            }
                        />
                        <MetricNote>
                            {healthError ??
                                (causes.length > 0
                                    ? causes.join(' · ')
                                    : 'Every subsystem check passed')}
                        </MetricNote>
                    </>
                )}
            </MetricCell>

            <MetricCell
                label="Accounts"
                icon={Users}
                openLabel={canOpen('users') ? 'Open users and access' : null}
                onOpen={() => onOpen('users')}
            >
                <MetricValue
                    value={`${accounts.active}${accounts.partial ? '+' : ''}`}
                    suffix={`active of ${accounts.total}${accounts.partial ? '+' : ''}`}
                />
                <MetricNote
                    tone={accounts.suspended.length > 0 ? 'warning' : 'default'}
                >
                    {accounts.suspended.length > 0
                        ? `${accounts.suspended.length} suspended`
                        : 'No suspended accounts'}
                </MetricNote>
            </MetricCell>

            <MetricCell
                label="AI advice this month"
                icon={Sparkles}
                openLabel={
                    canOpen('gpt-recommendations') ? 'Open AI advisory' : null
                }
                onOpen={() => onOpen('gpt-recommendations')}
            >
                {!ai && !aiError ? (
                    <MetricLoading label="Loading AI usage" />
                ) : !ai ? (
                    <MetricNote tone="warning">{aiError}</MetricNote>
                ) : (
                    <>
                        <MetricValue
                            value={formatUsd(ai.monthly_spend_usd)}
                            suffix={`of ${formatUsd(ai.monthly_budget_ceiling_usd)} budget`}
                            tone={
                                share !== null && share >= 1
                                    ? 'danger'
                                    : share !== null && share >= 0.8
                                      ? 'warning'
                                      : 'default'
                            }
                        />
                        <BudgetBar share={share} />
                        <MetricNote
                            tone={
                                ai.circuit_breaker_active
                                    ? 'warning'
                                    : 'default'
                            }
                        >
                            {ai.circuit_breaker_active
                                ? 'Paused · no new AI requests'
                                : ai.acceptance_rate === null
                                  ? 'Running · no decisions yet'
                                  : `Running · ${ai.acceptance_rate}% of advice accepted`}
                        </MetricNote>
                    </>
                )}
            </MetricCell>

            <MetricCell
                label="Audit activity"
                icon={FileText}
                openLabel={canOpen('audit') ? 'Open audit trail' : null}
                onOpen={() => onOpen('audit')}
            >
                {!audit && !auditError ? (
                    <MetricLoading label="Loading audit activity" />
                ) : !audit ? (
                    <MetricNote tone="warning">{auditError}</MetricNote>
                ) : (
                    <>
                        <MetricValue
                            value={String(audit.last_24h_total)}
                            suffix="events in 24 h"
                        />
                        <MetricNote>
                            {latest
                                ? `Latest: ${auditActionLabel(latest.action)}${
                                      latest.occurred_at
                                          ? ` · ${formatElapsed(latest.occurred_at, now) ?? ''} ago`
                                          : ''
                                  }`
                                : 'Nothing recorded yet'}
                        </MetricNote>
                    </>
                )}
            </MetricCell>
        </section>
    );
}

function MetricCell({
    label,
    icon: Icon,
    openLabel = null,
    onOpen,
    children,
}: {
    label: string;
    icon: LucideIcon;
    openLabel?: string | null;
    onOpen?: () => void;
    children: ReactNode;
}) {
    return (
        <div className="relative flex min-h-32 flex-col gap-1.5 bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-xs font-medium text-ink-soft">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                </h3>
                {openLabel && onOpen && (
                    <button
                        type="button"
                        onClick={onOpen}
                        aria-label={openLabel}
                        className="-m-2 grid size-9 place-items-center rounded-md text-ink-soft transition-colors hover:bg-surface-subtle hover:text-ink focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                    >
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                    </button>
                )}
            </div>
            {children}
        </div>
    );
}

function MetricValue({
    value,
    suffix,
    tone = 'default',
}: {
    value: string;
    suffix?: string;
    tone?: ValueTone;
}) {
    return (
        <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span
                className={cn(
                    'text-2xl font-semibold tracking-tight tabular-nums',
                    VALUE_TONES[tone],
                )}
            >
                {value}
            </span>
            {suffix && <span className="text-xs text-ink-soft">{suffix}</span>}
        </p>
    );
}

function MetricNote({
    children,
    tone = 'default',
}: {
    children: ReactNode;
    tone?: ValueTone;
}) {
    return (
        <p
            className={cn(
                'mt-auto text-xs leading-5',
                tone === 'default' ? 'text-ink-soft' : VALUE_TONES[tone],
            )}
        >
            {children}
        </p>
    );
}

function MetricLoading({ label }: { label: string }) {
    return (
        <div role="status" className="space-y-2">
            <span className="sr-only">{label}</span>
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-36" />
        </div>
    );
}

function BudgetBar({ share }: { share: number | null }) {
    if (share === null) {
        return null;
    }

    const percent = Math.min(100, Math.round(share * 100));

    return (
        <div
            role="meter"
            aria-label="Share of monthly AI budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"
        >
            <div
                className={cn(
                    'h-full rounded-full',
                    share >= 1
                        ? 'bg-danger'
                        : share >= 0.8
                          ? 'bg-warning'
                          : 'bg-ink-soft',
                )}
                style={{ width: `${Math.max(percent, share > 0 ? 2 : 0)}%` }}
            />
        </div>
    );
}
