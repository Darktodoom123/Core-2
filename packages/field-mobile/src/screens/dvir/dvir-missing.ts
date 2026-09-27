const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * What still stops the DVIR from being submitted, in the order the sections
 * appear, so the footer can say why Next is disabled.
 */
export function dvirMissingItems({
    readingsValid,
    shutdownChecksUnanswered,
    remarksMissing,
    attested,
}: {
    readingsValid: boolean;
    shutdownChecksUnanswered: number;
    remarksMissing: boolean;
    attested: boolean;
}): string[] {
    return [
        readingsValid ? null : 'engine hours',
        shutdownChecksUnanswered > 0
            ? plural(shutdownChecksUnanswered, 'shutdown check')
            : null,
        remarksMissing ? 'remarks' : null,
        attested ? null : 'your confirmation',
    ].filter((item): item is string => item !== null);
}
