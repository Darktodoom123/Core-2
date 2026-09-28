import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { dutyTarget } from '../navigation/dutyTarget';
import type { AssetAssignment, DispatchJob } from '../types/index';

const assignment = (id: number, code: string) =>
    ({ operational_asset_id: id, asset_code: code }) as AssetAssignment;
const job = (id: number, assets: AssetAssignment[]) =>
    ({ id, asset_assignments: assets }) as unknown as DispatchJob;

const working = job(2, [assignment(27, 'MOB-CRN-401')]);
const linked = job(1, [assignment(28, 'MOB-CRN-402')]);

describe('dutyTarget', () => {
    test('records a duty change on the linked unit even with other live jobs', () => {
        assert.deepEqual(
            dutyTarget({
                linkedJob: linked,
                linkedAsset: linked.asset_assignments![0],
                liveJobs: [working, linked],
                selectedJobId: null,
                selectedAssetId: null,
            }),
            { dispatchJobId: 1, operationalAssetId: 28 },
        );
    });

    test('without a link, uses the selected job, or the only live job', () => {
        const base = {
            linkedJob: null,
            linkedAsset: null,
            selectedAssetId: null,
        };

        assert.deepEqual(
            dutyTarget({
                ...base,
                liveJobs: [working, linked],
                selectedJobId: 2,
            }),
            { dispatchJobId: 2, operationalAssetId: 27 },
        );
        assert.deepEqual(
            dutyTarget({ ...base, liveJobs: [working], selectedJobId: null }),
            { dispatchJobId: 2, operationalAssetId: 27 },
        );
        assert.deepEqual(
            dutyTarget({
                ...base,
                liveJobs: [working, linked],
                selectedJobId: null,
            }),
            { dispatchJobId: null, operationalAssetId: null },
        );
    });
});
