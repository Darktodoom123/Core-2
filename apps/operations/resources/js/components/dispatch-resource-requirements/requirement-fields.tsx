import type { DispatchResourceRequirements } from '@/types/workspace';

const PERSONNEL_FIELDS = [
    ['driver', 'Drivers'],
    ['crane_operator', 'Crane operators'],
    ['rigger', 'Riggers / signalpersons'],
] as const;

const ASSET_FIELDS = [
    ['truck', 'Trucks'],
    ['vehicle', 'Vehicles'],
    ['crane', 'Cranes'],
    ['mobile_crane', 'Mobile cranes'],
    ['tower_crane', 'Tower cranes'],
    ['equipment', 'Other equipment'],
] as const;

export function emptyResourceRequirements(): DispatchResourceRequirements {
    return { personnel: {}, assets: {} };
}

export function ResourceRequirementFields({
    value,
    onChange,
    idPrefix,
}: {
    value: DispatchResourceRequirements;
    onChange: (value: DispatchResourceRequirements) => void;
    idPrefix: string;
}) {
    return (
        <div className="grid gap-5 md:grid-cols-2">
            <fieldset className="min-w-0">
                <legend className="text-sm font-semibold text-ink">
                    Required crew roles
                </legend>
                <div className="mt-2 space-y-2">
                    {PERSONNEL_FIELDS.map(([type, label]) => (
                        <label
                            key={type}
                            htmlFor={`${idPrefix}-personnel-${type}`}
                            className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink"
                        >
                            <span>{label}</span>
                            <input
                                id={`${idPrefix}-personnel-${type}`}
                                type="number"
                                min={0}
                                max={50}
                                step={1}
                                inputMode="numeric"
                                value={value.personnel[type] ?? 0}
                                onChange={(event) =>
                                    onChange({
                                        ...value,
                                        personnel: {
                                            ...value.personnel,
                                            [type]: Number(event.target.value),
                                        },
                                    })
                                }
                                className="h-11 w-20 rounded-lg border border-line-strong bg-surface px-2 text-right focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                            />
                        </label>
                    ))}
                </div>
            </fieldset>
            <fieldset className="min-w-0">
                <legend className="text-sm font-semibold text-ink">
                    Required equipment types
                </legend>
                <div className="mt-2 space-y-2">
                    {ASSET_FIELDS.map(([type, label]) => (
                        <label
                            key={type}
                            htmlFor={`${idPrefix}-assets-${type}`}
                            className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink"
                        >
                            <span>{label}</span>
                            <input
                                id={`${idPrefix}-assets-${type}`}
                                type="number"
                                min={0}
                                max={50}
                                step={1}
                                inputMode="numeric"
                                value={value.assets[type] ?? 0}
                                onChange={(event) =>
                                    onChange({
                                        ...value,
                                        assets: {
                                            ...value.assets,
                                            [type]: Number(event.target.value),
                                        },
                                    })
                                }
                                className="h-11 w-20 rounded-lg border border-line-strong bg-surface px-2 text-right focus-visible:ring-2 focus-visible:ring-brand-strong focus-visible:outline-hidden"
                            />
                        </label>
                    ))}
                </div>
            </fieldset>
        </div>
    );
}

export function resourceRequirementTotals(value: DispatchResourceRequirements) {
    return {
        personnel: Object.values(value.personnel).reduce(
            (sum, quantity) => sum + (quantity ?? 0),
            0,
        ),
        assets: Object.values(value.assets).reduce(
            (sum, quantity) => sum + (quantity ?? 0),
            0,
        ),
    };
}
