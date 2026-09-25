import type { SVGProps } from 'react';
import { FLEET_ASSET_CATEGORY_ICON_PATHS } from './fleet-asset-category-icon-paths.js';
import type { FleetAssetCategory } from './fleet-asset-classification';

export function FleetAssetCategoryIcon({
    category,
    ...props
}: SVGProps<SVGSVGElement> & { category: FleetAssetCategory }) {
    const paths = FLEET_ASSET_CATEGORY_ICON_PATHS[category];

    return (
        <svg
            {...props}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths.map((path) => (
                <path key={path} d={path} />
            ))}
        </svg>
    );
}
