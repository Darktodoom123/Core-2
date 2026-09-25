import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FleetAssetCategoryIcon } from '@/components/workspace/fleet/fleet-asset-category-icon';
import {
    FLEET_ASSET_CATEGORY_ICON_PATHS,
    getFleetAssetCategorySvgMarkup,
} from '@/components/workspace/fleet/fleet-asset-category-icon-paths';
import type { FleetAssetCategory } from '@/components/workspace/fleet/fleet-asset-classification';

const categories = Object.keys(
    FLEET_ASSET_CATEGORY_ICON_PATHS,
) as FleetAssetCategory[];

const pathData = (markup: string) =>
    [...markup.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);

describe('FleetAssetCategoryIcon', () => {
    it.each(categories)(
        'uses the same %s silhouette as the map marker',
        (category) => {
            const listIcon = renderToStaticMarkup(
                createElement(FleetAssetCategoryIcon, {
                    category,
                    className: 'h-4 w-4',
                }),
            );
            const mapIcon = getFleetAssetCategorySvgMarkup(category);

            expect(pathData(listIcon)).toEqual(pathData(mapIcon));
            expect(listIcon).toContain('viewBox="0 0 24 24"');
            expect(listIcon).toContain('stroke-width="1.9"');
            expect(listIcon).toContain('aria-hidden="true"');
        },
    );
});
