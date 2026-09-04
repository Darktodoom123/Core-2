import { router, usePage } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui';
import type {
    ProjectPhaseViewModel,
    ProjectPlanViewModel,
    ProjectShiftViewModel,
} from '@/types/workspace';

export type Role = 'driver' | 'crane_operator' | 'rigger';
export type Allocation = ProjectPhaseViewModel['allocations'][number];
export const roles: Role[] = ['crane_operator', 'rigger', 'driver'];
export const roleLabels: Record<Role, string> = {
    crane_operator: 'Operators',
    rigger: 'Riggers',
    driver: 'Drivers',
};
export function localValue(value: string | Date) {
    const date = new Date(value);

    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
}
export function shortDate(value: string | Date) {
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
export function datePayload<T extends { starts_at: string; ends_at: string }>(
    data: T,
) {
    return {
        ...data,
        starts_at: new Date(data.starts_at).toISOString(),
        ends_at: new Date(data.ends_at).toISOString(),
    };
}
export function updateContext(values: Record<string, string | null>) {
    const url = new URL(window.location.href);
    Object.entries(values).forEach(([key, value]) =>
        value === null
            ? url.searchParams.delete(key)
            : url.searchParams.set(key, value),
    );
    window.history.replaceState(window.history.state, '', url);
}
export function usePlanningMutation() {
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const send = (
        url: string,
        data: Record<string, unknown>,
        done?: () => void,
    ) => {
        if (busy) {
            return;
        }

        setBusy(true);
        setErrors([]);
        router.post(url, data as Parameters<typeof router.post>[1], {
            preserveScroll: true,
            onError: (messages) => setErrors(Object.values(messages)),
            onSuccess: done,
            onFinish: () => setBusy(false),
        });
    };

    return { send, busy, errors };
}
export async function planningGet<T>(
    url: string,
    signal?: AbortSignal,
): Promise<T> {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal,
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            body?.errors
                ? Object.values(body.errors).flat().join(' ')
                : 'Unable to load planning data. Refresh and try again.',
        );
    }

    return body as T;
}
export function Errors({ errors }: { errors: string[] }) {
    if (!errors.length) {
        return null;
    }

    return (
        <div
            role="alert"
            className="my-3 rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger-strong"
        >
            {errors.map((error) => (
                <p key={error}>{error}</p>
            ))}
        </div>
    );
}
export function Field({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <label className="block text-sm font-medium text-ink">
            <span>{label}</span>
            <span className="mt-2 block">{children}</span>
        </label>
    );
}
export function Dialog({
    title,
    description,
    onClose,
    children,
}: {
    title: string;
    description: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const { errors } = usePage().props;
    useEffect(() => {
        const dialog = ref.current;
        dialog?.showModal();

        return () => dialog?.close();
    }, []);

    return (
        <dialog
            ref={ref}
            onCancel={onClose}
            className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-xl border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/55"
            aria-labelledby="planning-dialog-title"
        >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface p-5">
                <div>
                    <h2
                        id="planning-dialog-title"
                        className="text-lg font-semibold"
                    >
                        {title}
                    </h2>
                    <p className="mt-1 text-sm text-ink-soft">{description}</p>
                </div>
                <Button
                    variant="quiet"
                    size="iconSm"
                    aria-label="Close dialog"
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>
            <div className="p-5">
                <Errors errors={Object.values(errors ?? {}) as string[]} />
                {children}
            </div>
        </dialog>
    );
}
export function crewCount(shift: ProjectShiftViewModel, role: Role) {
    return shift.personnel.filter(
        (p) => p.assignment_type === role && p.response !== 'rejected',
    ).length;
}
export function shiftIssues(
    plan: ProjectPlanViewModel,
    phase: ProjectPhaseViewModel,
    shift: ProjectShiftViewModel,
): string[] {
    if (['completed', 'cancelled'].includes(shift.status)) {
        return [];
    }

    const issues: string[] = [];

    if (plan.status !== 'approved') {
        issues.push('Baseline approval required');
    }

    if (shift.pending_roster) {
        issues.push('Crew exception awaiting approval');
    }

    for (const role of roles) {
        if (crewCount(shift, role) < phase.coverage[role]) {
            issues.push(
                `${roleLabels[role]} ${crewCount(shift, role)}/${phase.coverage[role]} — fill coverage`,
            );
        }
    }

    const reservations = phase.allocations.filter(
        (a) =>
            a.kind === 'reservation' &&
            a.starts_at <= shift.starts_at &&
            a.ends_at >= shift.ends_at,
    );

    if (!reservations.length) {
        issues.push('Reserve an asset for this shift');
    }

    if (
        phase.allocations.some(
            (a) =>
                a.kind === 'maintenance' &&
                a.starts_at < shift.ends_at &&
                a.ends_at > shift.starts_at &&
                reservations.some(
                    (r) => r.operational_asset_id === a.operational_asset_id,
                ),
        )
    ) {
        issues.push(
            'Maintenance interrupts this shift — adjust dates or reserve a replacement asset',
        );
    }

    if (
        plan.status === 'approved' &&
        shift.confirmed_plan_version !== plan.approved_version
    ) {
        issues.push('Reconfirm crew against the approved baseline');
    }

    return issues;
}
