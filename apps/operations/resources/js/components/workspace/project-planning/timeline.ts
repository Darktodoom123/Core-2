export type TimelineScale = 'week' | 'month' | 'quarter';

/** Four calendar intervals; labels and lanes share these exact boundaries. */
export function timelineWindow(date: string, scale: TimelineScale) {
    const first = new Date(`${date}T00:00:00`);
    const ticks = [first.getTime()];

    for (let index = 1; index <= 4; index++) {
        const tick = new Date(first);

        if (scale === 'week') {
            tick.setDate(first.getDate() + index * 7);
        } else {
            tick.setDate(1);
            tick.setMonth(
                scale === 'month'
                    ? first.getMonth() + index
                    : Math.floor(first.getMonth() / 3) * 3 + index * 3,
            );
        }

        ticks.push(tick.getTime());
    }

    return { start: ticks[0], end: ticks[4], ticks };
}
