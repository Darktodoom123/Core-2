import { useEffect, useRef } from 'react';
import type { ShiftInfo } from '../types';

export interface ResumeTrackingInput {
    isLinked: boolean;
    isSharing: boolean;
    /** The job allows location sharing for this operator. */
    canShare: boolean;
    shiftInfo: Pick<ShiftInfo, 'status' | 'hoursElapsed'>;
}

/**
 * Whether tracking should come back on by itself. A restored link means the
 * operator was working the unit, so tracking resumes (lifecycle v1.1, 4.3:
 * after a reboot, resume without re-linking) unless the server says they are
 * on a break or off shift. Offline the shift is unknown, and tracking resumes.
 */
export function shouldResumeTracking({
    isLinked,
    isSharing,
    canShare,
    shiftInfo,
}: ResumeTrackingInput): boolean {
    if (!isLinked || isSharing || !canShare) {
        return false;
    }

    // hoursElapsed stays undefined until the server has answered.
    const shiftKnown = shiftInfo.hoursElapsed !== undefined;

    return (
        !shiftKnown ||
        shiftInfo.status === 'on_shift' ||
        shiftInfo.status === 'standby'
    );
}

/**
 * Turns tracking back on once per app launch when a saved link comes back.
 * Once tracking has run this launch, a pause by the operator is left alone.
 */
export function useResumeTracking(
    input: ResumeTrackingInput,
    resume: () => void,
): void {
    const settledRef = useRef(false);
    const shouldResume = shouldResumeTracking(input);
    const { isLinked, isSharing } = input;

    useEffect(() => {
        if (settledRef.current) {
            return;
        }

        if (isLinked && isSharing) {
            settledRef.current = true;

            return;
        }

        if (shouldResume) {
            settledRef.current = true;
            resume();
        }
    }, [isLinked, isSharing, resume, shouldResume]);
}
