import type { UnitLink } from '../storage/unitLinkStore';
import type { OutboxCommand, ServerUnitLink } from '../types';

/** What the phone last heard from the server, and when it asked. */
export interface ServerUnitLinkSnapshot {
    link: ServerUnitLink | null;
    fetchedAt: number;
}

/** The phone's own view, and when the operator last linked or released. */
export interface LocalUnitLink {
    link: UnitLink | null;
    changedAt: number;
}

const LINK_COMMANDS = new Set(['link_unit', 'release_unit']);

function isLinkCommand(command: OutboxCommand): boolean {
    return LINK_COMMANDS.has(command.type);
}

/** A link or release still on its way to the server. */
export function hasPendingLinkChange(
    commands: readonly OutboxCommand[],
): boolean {
    return commands.some(
        (command) =>
            isLinkCommand(command) &&
            (command.state === 'queued' ||
                command.state === 'syncing' ||
                (command.state === 'failed' &&
                    command.error?.retryable !== false)),
    );
}

/** The server refused this link (someone else holds the unit, or it's locked out). */
function linkRefused(
    link: UnitLink,
    commands: readonly OutboxCommand[],
): boolean {
    const linkedAt = Date.parse(link.linkedAt);

    return commands.some(
        (command) =>
            command.type === 'link_unit' &&
            command.payload.asset_code === link.assetCode &&
            Date.parse(command.createdAt) >= linkedAt &&
            (command.state === 'conflict' ||
                (command.state === 'failed' &&
                    command.error?.retryable === false)),
    );
}

/**
 * The link the phone should act on. The server wins once every link change
 * made on this phone has reached it; until then the phone's own view stands,
 * so an offline link or release isn't undone by an older server answer.
 */
export function reconcileUnitLink(
    local: LocalUnitLink,
    server: ServerUnitLinkSnapshot | null,
    commands: readonly OutboxCommand[],
): UnitLink | null {
    if (local.link && linkRefused(local.link, commands)) {
        return null;
    }

    const serverIsCurrent =
        server !== null &&
        server.fetchedAt > local.changedAt &&
        !hasPendingLinkChange(commands);

    if (!serverIsCurrent) {
        return local.link;
    }

    if (server.link === null) {
        return null;
    }

    return {
        assetCode: server.link.asset_code,
        linkedAt: server.link.linked_at,
    };
}

/**
 * Checks the server's answer. Null means not linked; anything that isn't a
 * well-formed link throws, so a bad answer is never read as "unlinked".
 */
export function readServerUnitLink(raw: unknown): ServerUnitLink | null {
    if (raw === null) {
        return null;
    }

    if (
        typeof raw !== 'object' ||
        Array.isArray(raw) ||
        typeof (raw as Record<string, unknown>).asset_code !== 'string' ||
        typeof (raw as Record<string, unknown>).linked_at !== 'string' ||
        !Number.isFinite(
            Date.parse((raw as Record<string, unknown>).linked_at as string),
        )
    ) {
        throw new Error('The server sent an unreadable unit link.');
    }

    return raw as ServerUnitLink;
}

/** Changes whenever a link or release command moves, to refetch the server. */
export function linkCommandsKey(commands: readonly OutboxCommand[]): string {
    return commands
        .filter(isLinkCommand)
        .map((command) => `${command.id}:${command.state}`)
        .join('|');
}
