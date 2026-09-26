import { CircleAlert, CircleCheck, ReceiptText } from 'lucide-react';
import { Button, EmptyState, Panel } from '@/components/ui';
import type { FuelLogViewModel, FuelRequestViewModel } from '@/types/workspace';

function receiptState(log: FuelLogViewModel): {
    label: string;
    detail: string;
    tone: string;
    icon: typeof ReceiptText;
} {
    if (log.receipt_url) {
        return {
            label: 'Receipt attached',
            detail: log.receipt_number
                ? `Receipt no. ${log.receipt_number}`
                : 'Evidence available',
            tone: 'text-success-strong',
            icon: CircleCheck,
        };
    }

    if (log.no_receipt_reason) {
        return log.requires_receipt_review
            ? {
                  label: 'No receipt · needs review',
                  detail: log.no_receipt_reason.label,
                  tone: 'text-warning-strong',
                  icon: CircleAlert,
              }
            : {
                  label: 'No receipt · exception reviewed',
                  detail: log.no_receipt_reason.label,
                  tone: 'text-ink-soft',
                  icon: CircleCheck,
              };
    }

    return {
        label: 'Receipt not recorded',
        detail: 'Check the request for evidence',
        tone: 'text-ink-soft',
        icon: ReceiptText,
    };
}

export function FuelRecordsPanel({
    requests,
    consumption,
    canReviewReceipt,
    onOpenRequest,
}: {
    requests: FuelRequestViewModel[];
    consumption: boolean;
    canReviewReceipt: boolean;
    onOpenRequest: (id: number) => void;
}) {
    const records = requests.flatMap((request) =>
        (request.logs ?? []).map((log) => ({ request, log })),
    );

    return (
        <Panel className="p-4 sm:p-6">
            <h2 className="text-base font-semibold text-ink">
                {consumption ? 'Recorded consumption' : 'Fuel Logs'}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
                {consumption
                    ? 'Recorded burn rates use the equipment’s meter and baseline. Missing measurements are not treated as zero consumption.'
                    : 'Actual fuel received, linked to its request and the person who recorded it.'}
            </p>
            {records.length === 0 ? (
                <div className="py-8">
                    <EmptyState
                        compact
                        title="No fuel logs on this page"
                        message="Completed refueling logs appear here after fuel is recorded against a verified request."
                    />
                </div>
            ) : (
                <ul
                    className="mt-4 divide-y divide-line"
                    aria-label={
                        consumption ? 'Consumption records' : 'Fuel log records'
                    }
                >
                    {records.map(({ request, log }) => {
                        const receipt = receiptState(log);
                        const ReceiptIcon = receipt.icon;

                        return (
                            <li
                                key={log.id}
                                className="py-4 first:pt-0 last:pb-0"
                            >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium text-ink">
                                            {request.asset
                                                ? request.asset.name &&
                                                  request.asset.name !==
                                                      request.asset.code
                                                    ? `${request.asset.code} · ${request.asset.name}`
                                                    : request.asset.code
                                                : 'No asset linked'}
                                        </p>
                                        <p className="mt-1 text-xs text-ink-soft">
                                            {request.reference} ·{' '}
                                            {log.recorded_by?.name ??
                                                'Recorder unavailable'}
                                        </p>
                                        <p className="mt-1 text-xs text-ink-soft tabular-nums">
                                            {log.recorded_at
                                                ? new Date(
                                                      log.recorded_at,
                                                  ).toLocaleString()
                                                : 'Date unavailable'}
                                        </p>
                                        {!consumption && (
                                            <p
                                                className={`mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-medium ${receipt.tone}`}
                                            >
                                                <ReceiptIcon
                                                    className="h-3.5 w-3.5 shrink-0"
                                                    aria-hidden="true"
                                                />
                                                <span>{receipt.label}</span>
                                                <span className="font-normal text-ink-soft">
                                                    {receipt.detail}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant={
                                            log.requires_receipt_review &&
                                            !consumption
                                                ? 'secondary'
                                                : 'quiet'
                                        }
                                        size="sm"
                                        onClick={() =>
                                            onOpenRequest(request.id)
                                        }
                                    >
                                        {log.requires_receipt_review &&
                                        !consumption
                                            ? canReviewReceipt
                                                ? 'Review receipt exception'
                                                : 'View receipt exception'
                                            : `View request ${request.reference}`}
                                    </Button>
                                </div>
                                <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                                    <div>
                                        <dt className="text-xs text-ink-soft">
                                            Received
                                        </dt>
                                        <dd className="mt-1 font-medium tabular-nums">
                                            {log.quantity_litres} L
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-ink-soft">
                                            Meter reading
                                        </dt>
                                        <dd className="mt-1 tabular-nums">
                                            {log.hour_meter !== null
                                                ? `${log.hour_meter} hr`
                                                : log.odometer_km !== null
                                                  ? `${log.odometer_km} km`
                                                  : 'Not recorded'}
                                        </dd>
                                    </div>
                                    {consumption ? (
                                        <>
                                            <div>
                                                <dt className="text-xs text-ink-soft">
                                                    Effective burn rate
                                                </dt>
                                                <dd className="mt-1 tabular-nums">
                                                    {log.effective_burn_rate !=
                                                    null
                                                        ? `${log.effective_burn_rate} ${log.burn_rate_unit ?? ''}`
                                                        : 'Not evaluated'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-ink-soft">
                                                    Variance
                                                </dt>
                                                <dd className="mt-1 tabular-nums">
                                                    {log.variance_percentage !=
                                                    null
                                                        ? `${log.variance_percentage}%`
                                                        : 'Not evaluated'}
                                                    {log.is_anomaly && (
                                                        <span className="ml-2 font-medium text-danger-strong">
                                                            Flagged
                                                        </span>
                                                    )}
                                                </dd>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <dt className="text-xs text-ink-soft">
                                                    Recorded total cost
                                                </dt>
                                                <dd className="mt-1 tabular-nums">
                                                    {log.total_cost ??
                                                        'Not recorded'}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-xs text-ink-soft">
                                                    Fuel station
                                                </dt>
                                                <dd className="mt-1">
                                                    {log.fuel_station ||
                                                        'Not recorded'}
                                                </dd>
                                            </div>
                                        </>
                                    )}
                                </dl>
                                {consumption && log.anomaly_reason && (
                                    <p className="mt-3 text-sm text-danger-strong">
                                        {log.anomaly_reason}
                                    </p>
                                )}
                                {!consumption && log.receipt_url && (
                                    <a
                                        className="mt-3 inline-flex min-h-11 items-center rounded-xs text-sm font-medium text-brand-strong underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                                        href={log.receipt_url}
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        View receipt
                                    </a>
                                )}
                                {!consumption && log.remarks && (
                                    <p className="mt-2 text-sm text-ink-soft">
                                        {log.remarks}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Panel>
    );
}
