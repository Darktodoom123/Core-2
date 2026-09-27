import type { OutboxCommand } from '../types';

export function isUnitLinkCommand(command: OutboxCommand): boolean {
    return command.type === 'link_unit' || command.type === 'release_unit';
}

/**
 * Each ping is a separate point in time with its own command id, so the
 * server accepts it in any order and a resend is harmless.
 */
export function isLocationPing(command: OutboxCommand): boolean {
    return command.type === 'share_location';
}

/**
 * Pings never give up: one left unresolved or out of retries by an earlier
 * version of the app is sent again under the same command id.
 */
export function pingCanBeResent(command: OutboxCommand): boolean {
    return (
        isLocationPing(command) &&
        (command.state === 'unresolved' ||
            (command.state === 'failed' && command.error?.retryable === true))
    );
}

/**
 * A ping the server refused stays in the outbox for the operator but does
 * not hold up the pings after it. A ping waiting on a retry still does, so
 * an outage is not hammered with every ping.
 */
export function pingIsSettledAside(command: OutboxCommand): boolean {
    return (
        isLocationPing(command) &&
        (command.state === 'conflict' ||
            (command.state === 'failed' && command.error?.retryable !== true))
    );
}

function isLater(candidate: OutboxCommand, command: OutboxCommand): boolean {
    const candidateAt = Date.parse(candidate.createdAt);
    const commandAt = Date.parse(command.createdAt);

    return (
        candidateAt > commandAt ||
        (candidateAt === commandAt &&
            candidate.id.localeCompare(command.id) > 0)
    );
}

function isStillGoing(command: OutboxCommand): boolean {
    return (
        command.state === 'queued' ||
        command.state === 'syncing' ||
        (command.state === 'failed' && command.error?.retryable === true)
    );
}

/**
 * A later command that still depends on this one, so discarding it would
 * break their order. Job commands depend on earlier commands for the same
 * job; link and release depend only on each other; pings depend on nothing.
 */
export function hasLaterDependent(
    command: OutboxCommand,
    commands: readonly OutboxCommand[],
): boolean {
    if (
        command.jobId === null ||
        command.jobId === undefined ||
        isLocationPing(command)
    ) {
        return false;
    }

    const isLink = isUnitLinkCommand(command);

    return commands.some(
        (candidate) =>
            candidate.id !== command.id &&
            (isLink
                ? isUnitLinkCommand(candidate)
                : candidate.jobId === command.jobId &&
                  !isUnitLinkCommand(candidate) &&
                  !isLocationPing(candidate)) &&
            isLater(candidate, command) &&
            isStillGoing(candidate),
    );
}
