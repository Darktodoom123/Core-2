import { usePage } from '@inertiajs/react';
import type { ComponentProps } from 'react';
import { DispatchDesk } from '@/components/workspace/dispatch-desk';
import { LiveDispatchWorkspace } from '@/components/workspace/live-dispatch-workspace';
import {
    DispatchWorkspace,
    ResourceCoverageWorkspace,
} from '@/components/workspace/project-planning-workspace';
import type { Auth } from '@/types/auth';
import type { ProjectPlanningViewModel } from '@/types/workspace';

type DispatchWorkspaceEntryProps = ComponentProps<
    typeof LiveDispatchWorkspace
> & {
    planning?: ProjectPlanningViewModel | null;
};

export function DispatchWorkspaceEntry({
    planning,
    ...dispatchProps
}: DispatchWorkspaceEntryProps) {
    const { url, props } = usePage<{ auth?: Auth }>();
    const role = props.auth?.role;
    const fieldMode =
        (role === 'driver' || role === 'crane_operator') &&
        dispatchProps.capabilities.update_assigned_dispatch_status;
    const classic =
        new URLSearchParams(url.split('?')[1] ?? '').get(
            'dispatch_workspace',
        ) === 'classic';

    if (fieldMode) {
        return <LiveDispatchWorkspace {...dispatchProps} />;
    }

    if (classic) {
        return (
            <DispatchWorkspace
                planning={planning}
                assets={dispatchProps.assets ?? []}
                dispatches={<LiveDispatchWorkspace {...dispatchProps} />}
            />
        );
    }

    return (
        <DispatchDesk
            {...dispatchProps}
            resourceCoverage={
                planning ? (
                    <ResourceCoverageWorkspace
                        planning={planning}
                        assets={dispatchProps.assets ?? []}
                    />
                ) : undefined
            }
        />
    );
}
