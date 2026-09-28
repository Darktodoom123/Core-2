import { act } from '@testing-library/react-native';

// PanResponder skips a move whose timestamp it has already seen.
const touch = (x: number, y: number, time: number) => ({
    nativeEvent: {
        locationX: x,
        locationY: y,
        pageX: x,
        pageY: y,
        touches: [],
        changedTouches: [],
        timestamp: time,
    },
    touchHistory: {
        numberActiveTouches: 1,
        indexOfSingleActiveTouch: 0,
        mostRecentTimeStamp: time,
        touchBank: [
            {
                touchActive: true,
                startPageX: 20,
                startPageY: 30,
                startTimeStamp: 0,
                currentPageX: x,
                currentPageY: y,
                currentTimeStamp: time,
                previousPageX: x,
                previousPageY: y,
                previousTimeStamp: time - 1,
            },
        ],
    },
});

/** Draws one real stroke on the signature canvas, as a finger would. */
/** The canvas element as the test renderer gives it. */
interface Canvas {
    props: Record<string, (event: unknown) => void>;
}

export async function drawSignature(canvas: Canvas): Promise<void> {
    const points: Array<[number, number]> = [
        [20, 30],
        [40, 38],
        [60, 34],
        [80, 45],
        [100, 40],
    ];

    await act(async () => {
        canvas.props.onResponderGrant(touch(...points[0], 1));

        points.slice(1).forEach(([x, y], index) => {
            canvas.props.onResponderMove(touch(x, y, index + 2));
        });

        const [lastX, lastY] = points[points.length - 1];
        canvas.props.onResponderRelease(touch(lastX, lastY, points.length + 1));
    });
}
