import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import type * as NotificationsType from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { FieldApiClient } from './apiClient';

let Notifications: typeof NotificationsType | null = null;

try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
} catch {
    // Native module (ExpoPushTokenManager) not present in current binary build
}

const INSTALLATION_ID_STORAGE_KEY = 'core2_device_installation_id';

let cachedInstallationId: string | null = null;
let lastRegisteredToken: string | null = null;
let lastRegisteredAt: string | null = null;

export interface NotificationRegistrationResult {
    status: 'registered' | 'permission_denied' | 'error';
    token?: string;
    installationId?: string;
    error?: string;
}

/**
 * Configure default foreground notification presentation behavior.
 */
export function configureNotificationHandler(): void {
    if (!Notifications) {
        return;
    }

    try {
        Notifications.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: true,
                shouldShowList: true,
            }),
        });
    } catch {
        // Silently tolerate platforms or environments where setNotificationHandler is unavailable
    }
}

/**
 * Setup Android notification channels for dispatch and emergency alerts.
 */
export async function setupAndroidNotificationChannels(): Promise<void> {
    if (!Notifications) {
        return;
    }

    try {
        await Notifications.setNotificationChannelAsync('dispatch-urgent', {
            name: 'Urgent Dispatch Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#EF4444',
        });

        await Notifications.setNotificationChannelAsync('dispatch-updates', {
            name: 'Dispatch Updates',
            importance: Notifications.AndroidImportance.DEFAULT,
            vibrationPattern: [0, 150, 100, 150],
            lightColor: '#3B82F6',
        });

        await Notifications.setNotificationChannelAsync('sos-emergency', {
            name: 'Emergency SOS Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 500, 200, 500],
            lightColor: '#DC2626',
            bypassDnd: true,
        });
    } catch {
        // Tolerated in testing or headless environments
    }
}

/**
 * Get or generate a persistent UUID installation ID for this device installation.
 */
export async function getInstallationId(): Promise<string> {
    if (cachedInstallationId) {
        return cachedInstallationId;
    }

    try {
        let storedId = await SecureStore.getItemAsync(
            INSTALLATION_ID_STORAGE_KEY,
        );

        if (!storedId) {
            storedId = Crypto.randomUUID();
            await SecureStore.setItemAsync(
                INSTALLATION_ID_STORAGE_KEY,
                storedId,
            );
        }

        cachedInstallationId = storedId;

        return storedId;
    } catch {
        // Fallback to volatile UUID if SecureStore is unavailable
        const fallbackId = Crypto.randomUUID();
        cachedInstallationId = fallbackId;

        return fallbackId;
    }
}

/**
 * Check current notification permissions without prompting the user.
 */
export async function checkNotificationPermissions(): Promise<boolean> {
    if (!Notifications) {
        return false;
    }

    try {
        const { status } = await Notifications.getPermissionsAsync();

        return status === 'granted';
    } catch {
        return false;
    }
}

/**
 * Check current notification permissions or request if not yet granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Notifications) {
        return false;
    }

    try {
        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        return finalStatus === 'granted';
    } catch {
        return false;
    }
}

/**
 * Register device push token with backend API.
 */
export async function registerDevicePushToken(
    apiClient: FieldApiClient,
    appVersion?: string,
    platform: 'android' | 'ios' = Platform.OS === 'ios' ? 'ios' : 'android',
): Promise<NotificationRegistrationResult> {
    const hasPermission = await requestNotificationPermissions();

    if (!hasPermission) {
        return { status: 'permission_denied' };
    }

    try {
        await setupAndroidNotificationChannels();

        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;

        if (!Notifications) {
            return {
                status: 'error',
                error: 'Push notifications unavailable in this build',
            };
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined,
        );
        const token = tokenResponse.data;
        const installationId = await getInstallationId();

        // Avoid duplicate re-registration of identical token and installation
        if (lastRegisteredToken === token) {
            return { status: 'registered', token, installationId };
        }

        await apiClient.registerDeviceToken({
            token,
            installation_id: installationId,
            platform,
            provider: 'expo',
            app_version: appVersion,
        });

        lastRegisteredToken = token;
        lastRegisteredAt = new Date().toISOString();

        return { status: 'registered', token, installationId };
    } catch (err) {
        const message =
            err instanceof Error ? err.message : 'Push registration failed';

        return { status: 'error', error: message };
    }
}

/**
 * Revoke device push token on backend (e.g. on user logout).
 * Scoped by token and registeredBefore so older offline logout requests do not revoke newer registrations.
 */
export async function revokeDevicePushToken(
    apiClient: FieldApiClient,
): Promise<boolean> {
    try {
        const installationId = await getInstallationId();
        const tokenToRevoke = lastRegisteredToken;
        const registeredBefore = lastRegisteredAt ?? new Date().toISOString();
        await apiClient.revokeDeviceToken(
            installationId,
            tokenToRevoke,
            registeredBefore,
        );
        lastRegisteredToken = null;
        lastRegisteredAt = null;

        return true;
    } catch {
        lastRegisteredToken = null;
        lastRegisteredAt = null;

        return false;
    }
}

/**
 * Clear in-memory token cache (used on account switch or logout).
 */
export function clearNotificationTokenCache(): void {
    lastRegisteredToken = null;
    lastRegisteredAt = null;
    cachedInstallationId = null;
}

export function getLastRegisteredToken(): string | null {
    return lastRegisteredToken;
}

export function getLastRegisteredAt(): string | null {
    return lastRegisteredAt;
}

/**
 * Safely extracts job_id / dispatch_job_id from notification data.
 */
export function extractJobIdFromNotification(
    data: Record<string, unknown> | undefined,
): number | null {
    if (!data) {
        return null;
    }

    const rawId = data.job_id ?? data.dispatch_job_id;

    if (typeof rawId === 'number' && Number.isInteger(rawId) && rawId > 0) {
        return rawId;
    }

    if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) {
        const parsed = parseInt(rawId.trim(), 10);

        return parsed > 0 ? parsed : null;
    }

    return null;
}

/**
 * Safely extracts event name from notification data.
 */
export function extractEventFromNotification(
    data: Record<string, unknown> | undefined,
): string | null {
    if (!data || typeof data.event !== 'string') {
        return null;
    }

    return data.event;
}

/**
 * Safely extracts ticket_id from notification data.
 */
export function extractTicketIdFromNotification(
    data: Record<string, unknown> | undefined,
): string | null {
    if (!data) {
        return null;
    }

    const raw = data.ticket_id ?? data.id;

    return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

/**
 * Listeners setup for foreground notifications, notification response taps, and token refresh.
 */
export function setupNotificationListeners(options: {
    onNotificationReceived?: (
        notification: NotificationsType.Notification,
    ) => void;
    onNotificationResponse?: (
        response: NotificationsType.NotificationResponse,
    ) => void;
    onTokenRefresh?: (token: string) => void;
}): () => void {
    if (!Notifications) {
        return () => {};
    }

    const subscriptions: Array<{ remove: () => void }> = [];

    if (options.onNotificationReceived) {
        const sub = Notifications.addNotificationReceivedListener(
            options.onNotificationReceived,
        );
        subscriptions.push(sub);
    }

    if (options.onNotificationResponse) {
        const sub = Notifications.addNotificationResponseReceivedListener(
            options.onNotificationResponse,
        );
        subscriptions.push(sub);
    }

    if (options.onTokenRefresh) {
        const sub = Notifications.addPushTokenListener((tokenData) => {
            if (tokenData?.data) {
                options.onTokenRefresh!(tokenData.data);
            }
        });
        subscriptions.push(sub);
    }

    return () => {
        subscriptions.forEach((sub) => {
            try {
                sub.remove();
            } catch {
                // Ignore cleanup errors
            }
        });
    };
}

export async function getLastNotificationResponseAsync(): Promise<NotificationsType.NotificationResponse | null> {
    if (!Notifications) {
        return null;
    }

    try {
        return await Notifications.getLastNotificationResponseAsync();
    } catch {
        return null;
    }
}
