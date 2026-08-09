import type { BackgroundLocationContext } from './backgroundLocationContext';

export async function startBackgroundLocationUpdates(
    context: BackgroundLocationContext,
): Promise<void> {
    const task = await import('./backgroundLocationTask');

    await task.registerBackgroundLocationUpdates(context);
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
    const task = await import('./backgroundLocationTask');

    await task.stopBackgroundLocationUpdates();
}
