export interface BackgroundLocationContext {
    actorId: number;
    jobId: number;
    operationalAssetId?: number | null;
}

const backgroundLocationContextKey = 'core2_field_background_location_context';
const keychainService = 'com.core2.fieldmobile.authentication';

function isValidContext(value: unknown): value is BackgroundLocationContext {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const context = value as Partial<BackgroundLocationContext>;

    return (
        Number.isInteger(context.actorId) &&
        context.actorId! > 0 &&
        Number.isInteger(context.jobId) &&
        context.jobId! > 0 &&
        (context.operationalAssetId === undefined ||
            context.operationalAssetId === null ||
            Number.isInteger(context.operationalAssetId))
    );
}

export async function saveBackgroundLocationContext(
    context: BackgroundLocationContext,
): Promise<void> {
    if (!isValidContext(context)) {
        throw new Error('A valid authenticated location context is required.');
    }

    const secureStore = await import('expo-secure-store');

    await secureStore.setItemAsync(
        backgroundLocationContextKey,
        JSON.stringify(context),
        {
            keychainAccessible: secureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
            keychainService,
        },
    );
}

export async function loadBackgroundLocationContext(): Promise<BackgroundLocationContext | null> {
    const secureStore = await import('expo-secure-store');
    const raw = await secureStore.getItemAsync(backgroundLocationContextKey, {
        keychainService,
    });

    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as unknown;

        return isValidContext(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

export async function clearBackgroundLocationContext(): Promise<void> {
    const secureStore = await import('expo-secure-store');

    await secureStore.deleteItemAsync(backgroundLocationContextKey, {
        keychainService,
    });
}
