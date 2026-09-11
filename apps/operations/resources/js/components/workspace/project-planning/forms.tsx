import { useRef, useState } from 'react';
import { Button, Input, Select, Textarea } from '@/components/ui';
import type {
    AssetViewModel,
    ProjectPhaseViewModel,
    ProjectPlanViewModel,
} from '@/types/workspace';
import {
    datePayload,
    Dialog,
    Errors,
    Field,
    localValue,
    planningGet,
    roleLabels,
    roles,
    usePlanningMutation,
} from './shared';
import type { Allocation } from './shared';

export function ProjectForm({ onClose }: { onClose: () => void }) {
    const [data, setData] = useState({
        name: '',
        source_reference: '',
        client: '',
        site: '',
    });
    const command = usePlanningMutation();
    const labels = {
        name: 'Coverage record name',
        source_reference: 'Work reference (Core 1 or manual)',
        client: 'Client context',
        site: 'Operating site',
    };

    return (
        <Dialog
            title="Add resource coverage record"
            description="Record the operational schedule and resource coverage for Core 1 work. This local record does not create or update a Core 1 project. Manual intake remains valid when no handoff reference is available."
            onClose={onClose}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    command.send('/operations/project-plans', data, onClose);
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    {(Object.keys(data) as Array<keyof typeof data>).map(
                        (key) => (
                            <Field key={key} label={labels[key]}>
                                <Input
                                    required
                                    maxLength={
                                        key === 'source_reference' ? 150 : 255
                                    }
                                    value={data[key]}
                                    onChange={(e) =>
                                        setData({
                                            ...data,
                                            [key]: e.target.value,
                                        })
                                    }
                                />
                            </Field>
                        ),
                    )}
                </div>
                <p className="mt-3 text-xs leading-5 text-ink-soft">
                    Enter the originating Core 1 reference when you have one; a
                    manual work reference is also supported for operational
                    intake. These fields describe the local coverage record.
                </p>
                <Errors errors={command.errors} />
                <div className="mt-5 flex justify-end gap-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={command.busy}
                    >
                        {command.busy ? 'Creating…' : 'Create coverage record'}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

export function PhaseForm({
    plan,
    phase,
    onClose,
}: {
    plan: ProjectPlanViewModel;
    phase?: ProjectPhaseViewModel;
    onClose: () => void;
}) {
    const start = plan.phases.at(-1)?.ends_at ?? new Date().toISOString();
    const [data, setData] = useState({
        version: plan.version,
        name: phase?.name ?? 'Operations',
        kind: phase?.kind ?? 'operations',
        starts_at: localValue(phase?.starts_at ?? start),
        ends_at: localValue(
            phase?.ends_at ??
                new Date(new Date(start).getTime() + 90 * 86400000),
        ),
        coverage: phase?.coverage ?? {
            driver: 0,
            crane_operator: 1,
            rigger: 2,
        },
    });
    const [review, setReview] = useState(false);
    const command = usePlanningMutation();

    return (
        <Dialog
            title={phase ? 'Edit operating phase' : 'Add operating phase'}
            description="Set the operating dates and crew required for each shift in this phase."
            onClose={onClose}
        >
            <form
                onSubmit={(event) => {
                    event.preventDefault();

                    if (!review) {
                        setReview(true);
                    } else {
                        command.send(
                            `/operations/project-plans/${plan.id}/phases${phase ? `/${phase.id}` : ''}`,
                            datePayload(data),
                            onClose,
                        );
                    }
                }}
                onChange={() => setReview(false)}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Phase name">
                        <Input
                            required
                            value={data.name}
                            onChange={(e) =>
                                setData({ ...data, name: e.target.value })
                            }
                        />
                    </Field>
                    <Field label="Phase type">
                        <Select
                            value={data.kind}
                            onChange={(e) =>
                                setData({ ...data, kind: e.target.value })
                            }
                        >
                            {[
                                'mobilization',
                                'operations',
                                'standby',
                                'demobilization',
                            ].map((kind) => (
                                <option key={kind} value={kind}>
                                    {kind}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Starts (local time)">
                        <Input
                            required
                            type="datetime-local"
                            value={data.starts_at}
                            onChange={(e) =>
                                setData({ ...data, starts_at: e.target.value })
                            }
                        />
                    </Field>
                    <Field label="Ends (local time)">
                        <Input
                            required
                            type="datetime-local"
                            min={data.starts_at}
                            value={data.ends_at}
                            onChange={(e) =>
                                setData({ ...data, ends_at: e.target.value })
                            }
                        />
                    </Field>
                    {roles.map((role) => (
                        <Field
                            key={role}
                            label={`${roleLabels[role]} per shift`}
                        >
                            <Input
                                type="number"
                                min={0}
                                max={50}
                                required
                                value={data.coverage[role]}
                                onChange={(e) =>
                                    setData({
                                        ...data,
                                        coverage: {
                                            ...data.coverage,
                                            [role]: Number(e.target.value),
                                        },
                                    })
                                }
                            />
                        </Field>
                    ))}
                </div>
                {review && (
                    <div className="mt-4 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm text-warning-strong">
                        <strong>Baseline change</strong>
                        <p className="mt-1">
                            {plan.phases.reduce(
                                (sum, item) => sum + item.shifts.length,
                                0,
                            )}{' '}
                            linked shifts will require crew reconfirmation after
                            independent baseline approval. Existing allocations
                            and shifts must fit within the phase dates.
                        </p>
                    </div>
                )}
                <Errors errors={command.errors} />
                <div className="mt-5 flex justify-end gap-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={command.busy}
                    >
                        {review
                            ? 'Confirm phase change'
                            : 'Review phase change'}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

type AllocationPreview = {
    conflicts: string[];
    affected_shifts: Array<{ id: number; reference: string }>;
    approval: string;
};
export function AllocationForm({
    plan,
    phase,
    allocation,
    assets,
    moveDays = 0,
    onClose,
}: {
    plan: ProjectPlanViewModel;
    phase: ProjectPhaseViewModel;
    allocation?: Allocation;
    assets: AssetViewModel[];
    moveDays?: number;
    onClose: () => void;
}) {
    const [data, setData] = useState({
        version: plan.version,
        operational_asset_id: allocation?.operational_asset_id ?? 0,
        kind: allocation?.kind ?? 'reservation',
        starts_at: localValue(
            new Date(
                new Date(allocation?.starts_at ?? phase.starts_at).getTime() +
                    moveDays * 86400000,
            ),
        ),
        ends_at: localValue(
            new Date(
                new Date(allocation?.ends_at ?? phase.ends_at).getTime() +
                    moveDays * 86400000,
            ),
        ),
        notes: allocation?.notes ?? '',
    });
    const [preview, setPreview] = useState<AllocationPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const generation = useRef(0);
    const command = usePlanningMutation();
    const base = `/operations/project-plans/${plan.id}/phases/${phase.id}`;
    const review = async () => {
        const revision = ++generation.current;
        setLoading(true);
        setError('');
        setPreview(null);

        try {
            const query = new URLSearchParams(
                Object.entries(datePayload(data)).map(([key, value]) => [
                    key,
                    String(value),
                ]),
            );
            const result = await planningGet<AllocationPreview>(
                `${base}/allocation-preview${allocation ? `/${allocation.id}` : ''}?${query}`,
            );

            if (generation.current === revision) {
                setPreview(result);
            }
        } catch (caught) {
            if (generation.current === revision) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : 'Unable to preview the change.',
                );
            }
        } finally {
            if (generation.current === revision) {
                setLoading(false);
            }
        }
    };

    return (
        <Dialog
            title={
                allocation
                    ? `Edit ${allocation.code} resource coverage`
                    : 'Reserve an asset for this phase'
            }
            description="Record an asset reservation or maintenance window. Review affected shifts, conflicts, and approval consequences before saving."
            onClose={onClose}
        >
            <form
                onChange={() => {
                    generation.current++;
                    setPreview(null);
                    setLoading(false);
                }}
                onSubmit={(event) => {
                    event.preventDefault();

                    if (!preview) {
                        void review();
                    } else {
                        command.send(
                            `${base}/allocations${allocation ? `/${allocation.id}` : ''}`,
                            datePayload(data),
                            onClose,
                        );
                    }
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Asset">
                        <Select
                            required
                            value={data.operational_asset_id || ''}
                            onChange={(e) =>
                                setData({
                                    ...data,
                                    operational_asset_id: Number(
                                        e.target.value,
                                    ),
                                })
                            }
                        >
                            <option value="">Select an asset</option>
                            {allocation &&
                                !assets.some(
                                    (a) =>
                                        a.id ===
                                        allocation.operational_asset_id,
                                ) && (
                                    <option
                                        value={allocation.operational_asset_id}
                                    >
                                        {allocation.code}
                                    </option>
                                )}
                            {assets.map((asset) => (
                                <option key={asset.id} value={asset.id}>
                                    {asset.code} · {asset.name} (
                                    {asset.status.label})
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Allocation">
                        <Select
                            value={data.kind}
                            onChange={(e) =>
                                setData({
                                    ...data,
                                    kind: e.target.value as Allocation['kind'],
                                })
                            }
                        >
                            <option value="reservation">
                                On-site reservation
                            </option>
                            <option value="maintenance">
                                Maintenance / unavailable
                            </option>
                        </Select>
                    </Field>
                    <Field label="Starts (local time)">
                        <Input
                            required
                            type="datetime-local"
                            value={data.starts_at}
                            onChange={(e) =>
                                setData({ ...data, starts_at: e.target.value })
                            }
                        />
                    </Field>
                    <Field label="Ends (local time)">
                        <Input
                            required
                            type="datetime-local"
                            min={data.starts_at}
                            value={data.ends_at}
                            onChange={(e) =>
                                setData({ ...data, ends_at: e.target.value })
                            }
                        />
                    </Field>
                    <div className="sm:col-span-2">
                        <Field label="Notes">
                            <Textarea
                                maxLength={2000}
                                value={data.notes}
                                onChange={(e) =>
                                    setData({ ...data, notes: e.target.value })
                                }
                            />
                        </Field>
                    </div>
                </div>
                <Errors
                    errors={[...command.errors, ...(error ? [error] : [])]}
                />
                {preview && (
                    <section className="mt-4 rounded-lg border border-line bg-surface-subtle p-4 text-sm">
                        <h3 className="font-semibold">Change preview</h3>
                        <Errors errors={preview.conflicts} />
                        {!preview.conflicts.length && (
                            <p className="mt-2 text-success-strong">
                                No conflicting bookings found.
                            </p>
                        )}
                        <p className="mt-2">{preview.approval}</p>
                        <details className="mt-2">
                            <summary className="cursor-pointer font-medium">
                                {preview.affected_shifts.length} affected
                                dispatches
                            </summary>
                            <ul className="mt-2 max-h-32 overflow-auto">
                                {preview.affected_shifts.map((shift) => (
                                    <li key={shift.id}>{shift.reference}</li>
                                ))}
                            </ul>
                        </details>
                    </section>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={
                            loading ||
                            command.busy ||
                            Boolean(preview?.conflicts.length)
                        }
                    >
                        {loading
                            ? 'Checking…'
                            : preview
                              ? 'Confirm resource coverage change'
                              : 'Review change'}
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}

export function ShiftForm({
    plan,
    phase,
    onClose,
}: {
    plan: ProjectPlanViewModel;
    phase: ProjectPhaseViewModel;
    onClose: () => void;
}) {
    const [data, setData] = useState({
        version: plan.version,
        starts_at: localValue(phase.starts_at),
        ends_at: localValue(
            new Date(new Date(phase.starts_at).getTime() + 8 * 3600000),
        ),
        days: 5,
    });
    const command = usePlanningMutation();

    return (
        <Dialog
            title="Generate shift dispatches"
            description="Create daily dispatches at the same hours for up to seven days, then fill each shift's crew coverage."
            onClose={onClose}
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    command.send(
                        `/operations/project-plans/${plan.id}/phases/${phase.id}/shifts`,
                        datePayload(data),
                        onClose,
                    );
                }}
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First shift starts (local time)">
                        <Input
                            required
                            type="datetime-local"
                            value={data.starts_at}
                            onChange={(e) =>
                                setData({ ...data, starts_at: e.target.value })
                            }
                        />
                    </Field>
                    <Field label="First shift ends (local time)">
                        <Input
                            required
                            type="datetime-local"
                            min={data.starts_at}
                            value={data.ends_at}
                            onChange={(e) =>
                                setData({ ...data, ends_at: e.target.value })
                            }
                        />
                    </Field>
                    <Field label="Consecutive days">
                        <Input
                            required
                            type="number"
                            min={1}
                            max={7}
                            value={data.days}
                            onChange={(e) =>
                                setData({
                                    ...data,
                                    days: Number(e.target.value),
                                })
                            }
                        />
                    </Field>
                </div>
                <Errors errors={command.errors} />
                <div className="mt-5 flex justify-end">
                    <Button
                        type="submit"
                        variant="primary"
                        disabled={command.busy}
                    >
                        Generate {data.days} shift dispatches
                    </Button>
                </div>
            </form>
        </Dialog>
    );
}
