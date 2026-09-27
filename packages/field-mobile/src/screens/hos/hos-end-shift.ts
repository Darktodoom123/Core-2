/**
 * What ending the shift needs next (lifecycle steps 7 and 8):
 * - post_trip: linked to a machine with no post-trip DVIR yet;
 * - release: post-trip done, so ending the shift releases the machine;
 * - end: no machine linked, just end the shift.
 */
export type EndShiftStep = 'post_trip' | 'release' | 'end';

export function endShiftStepFor(
    linkedAssetCode: string | null | undefined,
    postTripDone: boolean,
): EndShiftStep {
    if (!linkedAssetCode) {
        return 'end';
    }

    return postTripDone ? 'release' : 'post_trip';
}
