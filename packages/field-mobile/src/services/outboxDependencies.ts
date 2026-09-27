import type { OutboxCommand } from '../types';

export function isUnitLinkCommand(command: OutboxCommand): boolean {
    return command.type === 'link_unit' || command.type === 'release_unit';
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
 * job; link and release depend only on each other.
 */
export function hasLaterDependent(
    command: OutboxCommand,
    commands: readonly OutboxCommand[],
): boolean {
    if (command.jobId === null || command.jobId === undefined) {
        return false;
    }

    const isLink = isUnitLinkCommand(command);

    return commands.some(
        (candidate) =>
            candidate.id !== command.id &&
            (isLink
                ? isUnitLinkCommand(candidate)
                : candidate.jobId === command.jobId &&
                  !isUnitLinkCommand(candidate)) &&
            isLater(candidate, command) &&
            isStillGoing(candidate),
    );
}
