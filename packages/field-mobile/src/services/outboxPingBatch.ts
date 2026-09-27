import type { OutboxCommand } from '../types';
import type { LocationBatchResult } from './apiClient';
import { isLocationPing } from './outboxDependencies';

/**
 * Pings per request. The server takes up to 50; 25 keeps each request short,
 * since the server stores each ping with its own call to the Tracking service.
 */
export const PING_BATCH_SIZE = 25;

/**
 * The pings to send together with `first`: queued, due pings in the same
 * queue line, in the order they were taken, up to the batch size.
 */
export function collectPingBatch(
    first: OutboxCommand,
    ordered: readonly OutboxCommand[],
    scopeOf: (command: OutboxCommand) => string,
    nowMs: number,
): OutboxCommand[] {
    const scope = scopeOf(first);
    const batch = [first];

    for (const command of ordered) {
        if (batch.length >= PING_BATCH_SIZE) {
            break;
        }

        const due =
            !command.nextAttemptAt ||
            Date.parse(command.nextAttemptAt) <= nowMs;

        if (
            command.id !== first.id &&
            isLocationPing(command) &&
            command.state === 'queued' &&
            due &&
            scopeOf(command) === scope &&
            Date.parse(command.createdAt) >= Date.parse(first.createdAt)
        ) {
            batch.push(command);
        }
    }

    return batch;
}

/**
 * Pairs each ping with the server's answer for it. A ping the server did not
 * answer gets undefined and is tried again later.
 */
export function answersFor(
    batch: readonly OutboxCommand[],
    answers: readonly LocationBatchResult[],
): Array<[OutboxCommand, LocationBatchResult | undefined]> {
    const byId = new Map(answers.map((answer) => [answer.commandId, answer]));

    return batch.map((command) => [command, byId.get(command.id)]);
}
