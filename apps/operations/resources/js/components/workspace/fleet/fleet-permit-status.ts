import type {
    AssetPermitItemViewModel,
    AssetViewModel,
} from '@/types/workspace';

export type FleetPermitIssue = 'expired' | 'expiring' | 'missing';

export interface FleetPermitBadge {
    issue: FleetPermitIssue;
    tone: 'danger' | 'warning' | 'neutral';
    label: string;
}

const SHORT_LABELS: Record<string, string> = {
    registrations: 'LTO registration',
    insurance: 'Insurance',
    emission_certs: 'Emission clearance',
    load_test_certs: 'Load test cert',
    road_permits: 'Road permit',
};

export function shortPermitLabel(item: AssetPermitItemViewModel): string {
    return SHORT_LABELS[item.category] ?? item.label;
}

/** The single most urgent permit issue for an asset, if any. */
export function getFleetPermitIssue(
    asset: AssetViewModel,
): FleetPermitIssue | null {
    const state = asset.permit_compliance?.state;

    return state === 'expired' || state === 'expiring' || state === 'missing'
        ? state
        : null;
}

export function describeDaysLeft(daysLeft: number): string {
    if (daysLeft <= 0) {
        return 'today';
    }

    return daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
}

export function getFleetPermitBadge(
    asset: AssetViewModel,
): FleetPermitBadge | null {
    const compliance = asset.permit_compliance;
    const issue = getFleetPermitIssue(asset);

    if (!compliance || !issue) {
        return null;
    }

    const matching = compliance.items.filter((item) =>
        issue === 'expired'
            ? item.state === 'expired' || item.state === 'revoked'
            : issue === 'missing'
              ? item.state === 'missing'
              : item.state === 'valid' && item.days_left !== null,
    );

    if (issue === 'expiring') {
        const soonest = [...matching].sort(
            (a, b) => (a.days_left ?? 0) - (b.days_left ?? 0),
        )[0];

        return {
            issue,
            tone: 'warning',
            label: `${shortPermitLabel(soonest)} expires ${describeDaysLeft(soonest.days_left ?? 0)}`,
        };
    }

    const [first] = matching;
    const more = matching.length > 1 ? ` +${matching.length - 1}` : '';

    return issue === 'expired'
        ? {
              issue,
              tone: 'danger',
              label: `${shortPermitLabel(first)} ${first.state === 'revoked' ? 'revoked' : 'expired'}${more}`,
          }
        : {
              issue,
              tone: first.blocks_dispatch ? 'danger' : 'neutral',
              label: `${shortPermitLabel(first)} missing${more}`,
          };
}
