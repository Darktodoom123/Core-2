import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ProfileSummary } from './profile-summary';
import { SyncStatusPill } from './sync-status-pill';
import type { SyncTone } from './sync-status-pill';

export { BellIcon, ProfileSummary } from './profile-summary';
export type { BellIconProps, ProfileSummaryProps } from './profile-summary';
export { SyncStatusPill } from './sync-status-pill';
export type { SyncStatusPillProps, SyncTone } from './sync-status-pill';

export interface FieldHeaderProps {
    userName?: string | null;
    userRole?: string | null;
    /** Connection is shown by the sync pill; kept for callers. */
    isOnline?: boolean | null;
    syncStatusLabel: string;
    syncStatusMessage: string;
    syncTone: SyncTone;
    /** False hides the pill while everything is synced; Settings shows it. */
    showSyncStatus?: boolean;
    onOpenProfile: () => void;
    notificationCount?: number;
    onOpenNotifications?: () => void;
    onOpenSyncSheet?: () => void;
}

export const FieldHeader: React.FC<FieldHeaderProps> = ({
    userName,
    userRole,
    syncStatusLabel,
    syncStatusMessage,
    syncTone,
    showSyncStatus = true,
    onOpenProfile,
    notificationCount,
    onOpenNotifications,
    onOpenSyncSheet,
}) => (
    <View style={styles.header} testID="field-header">
        {showSyncStatus ? (
            <SyncStatusPill
                label={syncStatusLabel}
                message={syncStatusMessage}
                onPress={onOpenSyncSheet}
                tone={syncTone}
            />
        ) : null}

        {userName || userRole ? (
            <ProfileSummary
                notificationCount={notificationCount}
                onOpenNotifications={onOpenNotifications}
                onOpenProfile={onOpenProfile}
                userName={userName}
                userRole={userRole}
            />
        ) : null}
    </View>
);

const styles = StyleSheet.create({
    header: {
        gap: 12,
        marginBottom: 16,
    },
});
